package com.commercetools.dataimport.products;

import com.commercetools.dataimport.CachedResources;
import com.neovisionaries.i18n.CountryCode;
import io.sphere.sdk.channels.Channel;
import io.sphere.sdk.models.LocalizedString;
import io.sphere.sdk.models.LocalizedStringEntry;
import io.sphere.sdk.models.Reference;
import io.sphere.sdk.products.*;
import io.sphere.sdk.products.attributes.*;
import io.sphere.sdk.producttypes.ProductType;
import io.sphere.sdk.utils.MoneyImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.batch.item.file.mapping.BeanWrapperFieldSetMapper;
import org.springframework.batch.item.file.mapping.FieldSetMapper;
import org.springframework.batch.item.file.transform.FieldSet;
import org.springframework.validation.BindException;

import javax.annotation.Nullable;
import java.util.List;
import java.util.Objects;
import java.util.Properties;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static java.util.stream.Collectors.toList;
import static java.util.stream.Collectors.toSet;

@Slf4j
public class ProductImportItemProcessor implements ItemProcessor<List<FieldSet>, ProductDraft> {

    private static final Pattern PRICE_PATTERN = Pattern.compile("(?:(?<country>\\w{2})-)?(?<currency>\\w{3}) (?<centAmount>\\d+)(?:|\\d+)?(?: (?<customerGroup>\\w+))?(?:#(?<channel>[\\w\\-]+))?$");

    private CachedResources cachedResources;

    public ProductImportItemProcessor(final CachedResources cachedResources) {
        this.cachedResources = cachedResources;
    }

    @Override
    public ProductDraft process(final List<FieldSet> items) throws Exception {
        if (!items.isEmpty()) {
            final FieldSet productLine = items.get(0);
            final ProductCsvEntry productEntry = lineToCsvEntry(productLine);
            final ProductType productType = cachedResources.fetchProductType(productEntry.getProductType());
            if (productType != null) {
                final List<ProductVariantDraft> variantDrafts = variantLinesToDrafts(items, productType);
                return productLineToDraft(productEntry, productType, variantDrafts);
            }
        }
        return null;
    }

    private ProductDraft productLineToDraft(final ProductCsvEntry productEntry, final ProductType productType,
                                            final List<ProductVariantDraft> variantDrafts) {
        final LocalizedString name = productEntry.getName().toLocalizedString();
        final LocalizedString slug = productEntry.getSlug().toLocalizedString();
        return ProductDraftBuilder.of(productType, name, slug, variantDrafts)
                // TODO add categories, tax categories, etc.
                .build();
    }

    private List<ProductVariantDraft> variantLinesToDrafts(final List<FieldSet> items, final ProductType productType) {
        return items.stream()
                .map(line -> {
                    try {
                        final ProductCsvEntry entry = lineToCsvEntry(line);
                        return variantLineToDraft(line, entry, productType);
                    } catch (BindException e) {
                        log.error("Could not parse product CSV entry", e);
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .collect(toList());
    }

    private ProductVariantDraft variantLineToDraft(final FieldSet line, final ProductCsvEntry entry, final ProductType productType) {
        return ProductVariantDraftBuilder.of()
                .sku(entry.getSku())
                .prices(parsePrices(entry.getPrices()))
                .attributes(parseAttributes(line, productType))
                .images(parseImages(entry.getImages()))
                .build();
    }

    private ProductCsvEntry lineToCsvEntry(final FieldSet line) throws BindException {
        final FieldSetMapper<ProductCsvEntry> fieldSetMapper = new BeanWrapperFieldSetMapper<ProductCsvEntry>() {{
            setDistanceLimit(3);
            setTargetType(ProductCsvEntry.class);
            setStrict(false);
        }};
        return fieldSetMapper.mapFieldSet(line);
    }

    @Nullable
    private List<Image> parseImages(@Nullable final String images) {
        if (images != null && !images.isEmpty()) {
            return Stream.of(images.split(";"))
                    .filter(image -> !image.isEmpty())
                    .map(this::parseImage)
                    .collect(toList());
        }
        return null;
    }

    private Image parseImage(final String images) {
        return Image.of(images, ImageDimensions.of(0, 0));
    }

    @Nullable
    private List<PriceDraft> parsePrices(@Nullable final String prices) {
        if (prices != null && !prices.isEmpty()) {
            return Stream.of(prices.split(";"))
                    .filter(price -> !price.isEmpty())
                    .map(this::parsePrice)
                    .collect(toList());
        }
        return null;
    }

    private PriceDraft parsePrice(final String price) {
        final Matcher matcher = PRICE_PATTERN.matcher(price);
        if (!matcher.find()) {
            throw new RuntimeException("Cannot parse price: " + price);
        }
        final Long centAmount = Long.parseLong(matcher.group("centAmount"));
        final String currency = matcher.group("currency");
        return PriceDraftBuilder.of(MoneyImpl.ofCents(centAmount, currency))
                .country(extractCountry(matcher))
                .customerGroupId(extractCustomerGroupId(matcher))
                .channel(extractChannelRef(matcher))
                .build();
    }

    private CountryCode extractCountry(final Matcher matcher) {
        final String code = matcher.group("country");
        return code != null ? CountryCode.getByCode(code) : null;
    }

    private String extractCustomerGroupId(final Matcher matcher) {
        final String customerGroup = matcher.group("customerGroup");
        return customerGroup != null ? cachedResources.fetchCustomerGroupId(customerGroup) : null;
    }

    private Reference<Channel> extractChannelRef(final Matcher matcher) {
        final String channel = matcher.group("channel");
        return channel != null ? cachedResources.fetchChannelRef(channel) : null;
    }

    private List<AttributeDraft> parseAttributes(final FieldSet line, final ProductType productType) {
        return productType.getAttributes().stream()
                .map(attr -> parseAttribute(line, attr))
                .filter(draft -> draft != null && draft.getValue() != null)
                .collect(toList());
    }

    private AttributeDraft parseAttribute(final FieldSet line, final AttributeDefinition attr) {
        final AttributeType attributeType = attr.getAttributeType();
        if (attributeType instanceof DateTimeAttributeType || attributeType instanceof StringAttributeType
                || attributeType instanceof EnumAttributeType || attributeType instanceof LocalizedEnumAttributeType
                || attributeType instanceof BooleanAttributeType) {
            return extractStringLikeAttributeDraft(line, attr.getName());
        } else if(attributeType instanceof LocalizedStringAttributeType) {
            return extractLocalizedStringAttributeDraft(line, attr.getName());
        } else if (attributeType instanceof SetAttributeType) {
            return extractSetAttributeDraft(line, (SetAttributeType) attributeType, attr.getName());
        } else {
            throw new RuntimeException("Not supported attribute type " + attributeType);
        }
    }

    private AttributeDraft extractSetAttributeDraft(final FieldSet line, final SetAttributeType attributeType, final String name) {
        final AttributeType elementType = attributeType.getElementType();
        final Properties properties = line.getProperties();
        if (elementType instanceof StringAttributeType) {
            final Set<String> values = Stream.of(properties.getProperty(name).split(";")).collect(toSet());
            return AttributeDraft.of(name, values);
        } else {
            throw new UnsupportedOperationException("Not supported element type of attribute type " + attributeType + " for field " + name);
        }
    }

    private AttributeDraft extractLocalizedStringAttributeDraft(final FieldSet line, final String attrName) {
        final LocalizedString localizedString = streamOfLocalizedFields(line, attrName)
                .map(columnName -> {
                    final String value = line.getProperties().getProperty(columnName);
                    final String locale = columnName.replace(attrName + ".", "");
                    return LocalizedStringEntry.of(locale, value);
                })
                .filter(entry -> entry.getValue() != null && !entry.getValue().isEmpty())
                .collect(LocalizedString.streamCollector());
        return AttributeDraft.of(attrName, localizedString);
    }

    @Nullable
    private AttributeDraft extractStringLikeAttributeDraft(final FieldSet line, final String name) {
        final String value = line.getProperties().getProperty(name);
        return value != null && !value.isEmpty() ? AttributeDraft.of(name, value) : null;
    }

    private Stream<String> streamOfLocalizedFields(final FieldSet line, final String attrName) {
        return Stream.of(line.getNames()).filter(columnName -> columnName.startsWith(attrName + "."));
    }
}
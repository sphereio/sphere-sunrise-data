package com.commercetools.dataimport.channels;

import com.commercetools.dataimport.TypesImportJobConfiguration;
import io.sphere.sdk.types.TypeDraft;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.item.ItemReader;
import org.springframework.batch.item.ItemWriter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ChannelTypesImportJobConfiguration extends TypesImportJobConfiguration {

    @Bean
    public Job channelTypesImportJob(final Step channelTypesImportStep) {
        return jobBuilderFactory.get("channelTypesImportJob")
                .start(channelTypesImportStep)
                .build();
    }

    @Bean
    public Step channelTypesImportStep(final ItemReader<TypeDraft> typeImportReader,
                                       final ItemWriter<TypeDraft> typeImportWriter) {
        return stepBuilderFactory.get("channelTypesImportStep")
                .<TypeDraft, TypeDraft>chunk(1)
                .reader(typeImportReader)
                .writer(typeImportWriter)
                .build();
    }
}
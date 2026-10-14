package review.engine;

import review.context.reviewContext;
import review.context.reviewContextBuilder;
import review.model.featureDocument;
import review.model.reviewResult;
import review.model.severity;
import review.model.violation;
import review.parser.featureFileCollector;
import review.parser.featureParser;
import review.report.markdownReportBuilder;
import review.rules.*;

import java.io.IOException;
import java.util.List;

public class pullRequestReviewEngine {

    public reviewResult execute() throws IOException {


        reviewContext context =
                new reviewContextBuilder().build();

        featureFileCollector collector =
                new featureFileCollector();

        featureParser parser =
                new featureParser();

        List<featureDocument> features =
                collector.collect(context)
                        .stream()
                        .map(parser::parse)
                        .toList();

        // Registrar reglas
        List<reviewRule> rules =
                List.of(
                        new branchNamingRule(),
                        new featureNamingRule(),
                        new mandatoryTagsRule(),
                        new branchTagConsistencyRule(),
                        new noJavaScriptRule(),
                        new noInlineJavaRule(),
                        new singleBackgroundRule(),
                        new singleFeatureRule(),
                        new backgroundRequiredRule()
                );

        System.out.println(
                "Rules loaded: "
                        + rules.size());

        ruleExecutor executor =
                new ruleExecutor(rules);

        // Ejecutar reglas
        List<violation> violations =
                executor.execute(
                        context,
                        features
                );

        // Contabilizar severidades
        int blockers = (int) violations.stream()
                .filter(v ->
                        v.severity() == severity.BLOCKER)
                .count();

        int warnings = (int) violations.stream()
                .filter(v ->
                        v.severity() == severity.WARNING)
                .count();

        reviewResult result =
                new reviewResult(
                        blockers == 0,
                        blockers,
                        warnings,
                        violations
                );

        System.out.println("Features encontradas:");

        features.forEach(feature ->
                System.out.println(
                        feature.path()
                )
        );


        new markdownReportBuilder()
                .build(result);

        // Resultado consolidado
        return result;
    }
}

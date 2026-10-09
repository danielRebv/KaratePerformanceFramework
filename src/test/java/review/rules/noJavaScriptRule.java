package review.rules;

import review.context.reviewContext;
import review.model.featureDocument;
import review.model.severity;
import review.model.violation;

import java.util.ArrayList;
import java.util.List;

public class noJavaScriptRule implements reviewRule {

    private static final List<String> JAVASCRIPT_PATTERNS =
            List.of(
                    "function",
                    "eval(",
                    "var ",
                    "karate.map(",
                    "karate.filter(",
                    "=>"
            );

    @Override
    public List<violation> validate(
            reviewContext context,
            List<featureDocument> features) {

        List<violation> violations =
                new ArrayList<>();

        for (featureDocument feature : features) {

            List<String> lines =
                    feature.content();

            for (int i = 0; i < lines.size(); i++) {

                String line = lines.get(i);

                for (String pattern : JAVASCRIPT_PATTERNS) {

                    if (line.contains(pattern)) {

                        violations.add(
                                new violation(
                                        "RULE-005",
                                        feature.featureName(),
                                        i + 1,
                                        severity.BLOCKER,
                                        "JavaScript detectado [" + pattern + "]",
                                        "Código encontrado: "
                                                + line.trim()
                                                + " | Mover lógica a utils"
                                )
                        );

                        break;
                    }
                }
            }
        }

        return violations;
    }
}
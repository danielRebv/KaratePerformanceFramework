package review.rules;

import review.context.reviewContext;
import review.model.featureDocument;
import review.model.severity;
import review.model.violation;

import java.util.ArrayList;
import java.util.List;

public class noInlineJavaRule implements reviewRule {

    private static final List<String> JAVA_PATTERNS =
            List.of(
                    "java.time.",
                    "LocalDate",
                    "LocalDateTime",
                    "ZonedDateTime",
                    "UUID.randomUUID",
                    "java.util.UUID",
                    "SecureRandom",
                    "java.security.",
                    "java.util.Base64",
                    "Base64.getEncoder",
                    "Base64.getDecoder"
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

                String line =
                        lines.get(i);

                for (String pattern : JAVA_PATTERNS) {

                    if (line.contains(pattern)) {

                        violations.add(
                                new violation(
                                        "RULE-010",
                                        feature.featureName(),
                                        i + 1,
                                        severity.BLOCKER,
                                        "Java Inline detectado [" + pattern + "]",
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
package review.rules;

import review.context.reviewContext;
import review.model.featureDocument;
import review.model.severity;
import review.model.violation;

import java.util.ArrayList;
import java.util.List;

public class singleFeatureRule
        implements reviewRule {

    @Override
    public List<violation> validate(
            reviewContext context,
            List<featureDocument> features) {

        List<violation> violations =
                new ArrayList<>();

        for (featureDocument feature : features) {

            if (feature.featureCount() > 1) {

                violations.add(
                        new violation(
                                "RULE-009",
                                feature.featureName(),
                                1,
                                severity.BLOCKER,
                                "Se detectaron "
                                        + feature.featureCount()
                                        + " declaraciones Feature",
                                "Mantener una única declaración Feature por archivo"
                        )
                );
            }
        }

        return violations;
    }
}
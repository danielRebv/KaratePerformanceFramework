package review.rules;

import review.context.reviewContext;
import review.model.featureDocument;
import review.model.severity;
import review.model.violation;

import java.util.ArrayList;
import java.util.List;

public class singleBackgroundRule
        implements reviewRule {

    @Override
    public List<violation> validate(
            reviewContext context,
            List<featureDocument> features) {

        List<violation> violations =
                new ArrayList<>();

        for (featureDocument feature : features) {

            if (feature.backgroundCount() > 1) {

                violations.add(
                        new violation(
                                "RULE-008",
                                feature.featureName(),
                                1,
                                severity.BLOCKER,
                                "Se detectaron "
                                        + feature.backgroundCount()
                                        + " bloques Background",
                                "Mantener un único Background por Feature"
                        )
                );
            }
        }

        return violations;
    }
}
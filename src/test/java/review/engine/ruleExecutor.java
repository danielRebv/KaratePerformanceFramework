package review.engine;

import review.context.reviewContext;
import review.model.featureDocument;
import review.model.violation;
import review.rules.reviewRule;

import java.util.ArrayList;
import java.util.List;

public class ruleExecutor {

    private final List<reviewRule> rules;

    public ruleExecutor(
            List<reviewRule> rules) {

        this.rules = rules;
    }

    public List<violation> execute(
            reviewContext context,
            List<featureDocument> features) {

        List<violation> violations =
                new ArrayList<>();

        for (reviewRule rule : rules) {

            violations.addAll(
                    rule.validate(
                            context,
                            features
                    )
            );
        }

        return violations;
    }
}
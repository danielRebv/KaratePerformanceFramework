package review.rules;

import review.context.reviewContext;
import review.model.featureDocument;
import review.model.violation;

import java.util.List;

public interface reviewRule {

    List<violation> validate(
            reviewContext context,
            List<featureDocument> features
    );

}
package review.model;

import java.util.List;

public record scenarioDocument (
        String name,
        Integer line,
        List<String> tags,
        Integer responseStatus
) {
}

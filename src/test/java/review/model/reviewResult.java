package review.model;

import java.util.List;

public record reviewResult (
        boolean approved,
        Integer blockers,
        Integer warnings,
        List<violation> violations
) {
}

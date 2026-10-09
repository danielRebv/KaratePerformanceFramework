package review.model;


public record violation(
        String ruleCode,
        String file,
        Integer line,
        severity severity,
        String message,
        String proposal
) {
}

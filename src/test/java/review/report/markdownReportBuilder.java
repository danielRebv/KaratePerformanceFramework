package review.report;

import review.model.reviewResult;
import review.model.violation;

public class markdownReportBuilder {
    public String build(
            reviewResult result
    ){
        StringBuilder builder = new StringBuilder();
        builder.append("# QA PR Review\n\n");
        for (violation violation : result.violations()){
            builder.append("##").append(violation.ruleCode()).append("\n");
            builder.append("- Archivo: ").append(violation.file()).append("\n");
            builder.append("- Error: ").append(violation.message()).append("\n");
            builder.append("- Propuesta: ").append(violation.proposal()).append("\n");
        }
        return builder.toString();
    }
}

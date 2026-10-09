package review.model;

import java.nio.file.Path;
import java.util.List;

public record featureDocument(

        String featureName,
        Path path,
        Integer featureLine,
        boolean hasBackground,
        Integer backgroundCount,
        Integer featureCount,
        List<String> tags,
        List<scenarioDocument> scenarios,
        List<String> content

){}
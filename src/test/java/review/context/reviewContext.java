package review.context;

import java.nio.file.Path;
import java.util.List;

public record reviewContext (
        String branchName,
        String targetBranch,
        List<Path> modifiedFiles
) {
}

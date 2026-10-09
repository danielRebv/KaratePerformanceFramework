package review.parser;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Stream;

public class featureFileCollector {

    public List<Path> collect() throws IOException {

        try (Stream<Path> paths =
                     Files.walk(
                             Paths.get(
                                     "src/test/java/features"
                             ))) {

            return paths
                    .filter(path ->
                            path.toString()
                                    .endsWith(".feature"))
                    .toList();
        }
    }
}
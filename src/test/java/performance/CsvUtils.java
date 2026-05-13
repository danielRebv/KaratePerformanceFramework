package performance;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.LinkedHashMap;

public class CsvUtils {
    private static int sequentialIndex = 1;

    public static String getRandomValue(
            String fileName,
            String columnName
    ) {

        try {

            InputStream inputStream =
                    CsvUtils.class
                            .getClassLoader()
                            .getResourceAsStream(
                                    "performance/feeders/" + fileName
                            );

            if (inputStream == null) {

                throw new RuntimeException(
                        "CSV not found: " + fileName
                );
            }

            BufferedReader reader =
                    new BufferedReader(
                            new InputStreamReader(inputStream)
                    );

            List<String> lines = new ArrayList<>();

            String line;

            while ((line = reader.readLine()) != null) {

                lines.add(line);
            }

            if (lines.isEmpty()) {

                throw new RuntimeException(
                        "CSV is empty: " + fileName
                );
            }

            String header = lines.get(0);

            String[] columns = header.split(",");

            int columnIndex = -1;

            for (int i = 0; i < columns.length; i++) {

                if (columns[i].trim().equals(columnName)) {

                    columnIndex = i;
                    break;
                }
            }

            if (columnIndex == -1) {

                throw new RuntimeException(
                        "Column not found: " + columnName
                );
            }

            Random random = new Random();

            int randomLine =
                    1 + random.nextInt(lines.size() - 1);

            String[] values =
                    lines.get(randomLine).split(",");

            return values[columnIndex].trim();

        } catch (Exception e) {

            e.printStackTrace();

            throw new RuntimeException(e);
        }
    }

    public static String getSequentialValue(
            String fileName,
            String columnName
    ) {

        try {

            InputStream inputStream =
                    CsvUtils.class
                            .getClassLoader()
                            .getResourceAsStream(
                                    "performance/feeders/" +
                                            fileName
                            );

            if (inputStream == null) {

                throw new RuntimeException(
                        "CSV not found: " + fileName
                );
            }

            BufferedReader reader =
                    new BufferedReader(
                            new InputStreamReader(
                                    inputStream
                            )
                    );

            List<String> lines =
                    new ArrayList<>();

            String line;

            while ((line = reader.readLine()) != null) {

                lines.add(line);
            }

            String header = lines.get(0);

            String[] columns =
                    header.split(",");

            int columnIndex = -1;

            for (int i = 0; i < columns.length; i++) {

                if (
                        columns[i]
                                .trim()
                                .equals(columnName)
                ) {

                    columnIndex = i;
                    break;
                }
            }

            if (columnIndex == -1) {

                throw new RuntimeException(
                        "Column not found: " +
                                columnName
                );
            }

            if (sequentialIndex >= lines.size()) {

                sequentialIndex = 1;
            }

            String[] values =
                    lines.get(sequentialIndex)
                            .split(",");

            sequentialIndex++;

            return values[columnIndex]
                    .trim();

        } catch (Exception e) {

            throw new RuntimeException(e);
        }
    }

    public static String feeder(
            String columnName,
            String strategy
    ) {

        String feederFile =
                System.getProperty(
                        "feeder.file"
                );

        switch (strategy.toLowerCase()) {

            case "sequential":

                return getSequentialValue(
                        feederFile,
                        columnName
                );

            case "random":

            default:

                return getRandomValue(
                        feederFile,
                        columnName
                );
        }
    }

    public static LinkedHashMap<String, Object> row(
            String strategy
    ) {

        String feederFile =
                System.getProperty(
                        "feeder.file"
                );

        try {

            InputStream inputStream =
                    CsvUtils.class
                            .getClassLoader()
                            .getResourceAsStream(
                                    "performance/feeders/" +
                                            feederFile
                            );

            if (inputStream == null) {

                throw new RuntimeException(
                        "CSV not found: " + feederFile
                );
            }

            BufferedReader reader =
                    new BufferedReader(
                            new InputStreamReader(
                                    inputStream
                            )
                    );

            List<String> lines =
                    new ArrayList<>();

            String line;

            while ((line = reader.readLine()) != null) {

                lines.add(line);
            }

            String[] headers =
                    lines.get(0).split(",");

            int rowIndex;

            switch (strategy.toLowerCase()) {

                case "sequential":

                    if (sequentialIndex >= lines.size()) {

                        sequentialIndex = 1;
                    }

                    rowIndex = sequentialIndex;
                    sequentialIndex++;

                    break;

                case "random":

                default:

                    Random random = new Random();

                    rowIndex =
                            1 + random.nextInt(
                                    lines.size() - 1
                            );
            }

            String[] values =
                    lines.get(rowIndex)
                            .split(",");

            LinkedHashMap<String, Object> row =
                    new LinkedHashMap<>();

            for (int i = 0; i < headers.length; i++) {

                row.put(
                        headers[i].trim(),
                        values[i].trim()
                );
            }

            return row;

        } catch (Exception e) {

            throw new RuntimeException(e);
        }
    }
}
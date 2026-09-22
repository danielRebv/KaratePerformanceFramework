package performance;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Random;

public class CsvUtils {

    private static int sequentialIndex = 1;

    private static final String FEEDERS_PATH =
            "performance/feeders/";

    public static String getRandomValue(
            String fileName,
            String columnName
    ) {

        try {

            List<String> lines =
                    readCsv(fileName);

            String[] columns =
                    lines.get(0).split(",");

            int columnIndex =
                    getColumnIndex(
                            columns,
                            columnName
                    );

            Random random =
                    new Random();

            int randomLine =
                    1 + random.nextInt(
                            lines.size() - 1
                    );

            String[] values =
                    lines.get(randomLine)
                            .split(",");

            if (columnIndex >= values.length) {

                return "";
            }

            return values[columnIndex]
                    .trim();

        } catch (Exception e) {

            throw new RuntimeException(e);
        }
    }

    public static String getSequentialValue(
            String fileName,
            String columnName
    ) {

        try {

            List<String> lines =
                    readCsv(fileName);

            String[] columns =
                    lines.get(0).split(",");

            int columnIndex =
                    getColumnIndex(
                            columns,
                            columnName
                    );

            if (sequentialIndex >= lines.size()) {

                sequentialIndex = 1;
            }

            String[] values =
                    lines.get(sequentialIndex)
                            .split(",");

            sequentialIndex++;

            if (columnIndex >= values.length) {

                return "";
            }

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

            List<String> lines =
                    readCsv(feederFile);

            String[] headers =
                    lines.get(0)
                            .split(",");

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

                    Random random =
                            new Random();

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

                String value =
                        i < values.length
                                ? values[i].trim()
                                : "";

                row.put(
                        headers[i].trim(),
                        value
                );
            }

            return row;

        } catch (Exception e) {

            throw new RuntimeException(e);
        }
    }

    private static List<String> readCsv(
            String fileName
    ) {

        try {

            InputStream inputStream =
                    CsvUtils.class
                            .getClassLoader()
                            .getResourceAsStream(
                                    FEEDERS_PATH + fileName
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

                if (!line.trim().isEmpty()) {

                    lines.add(line);
                }
            }

            if (lines.isEmpty()) {

                throw new RuntimeException(
                        "CSV is empty: " + fileName
                );
            }

            if (lines.size() <= 1) {

                throw new RuntimeException(
                        "CSV has no data rows: "
                                + fileName
                );
            }

            return lines;

        } catch (Exception e) {

            throw new RuntimeException(e);
        }
    }

    private static int getColumnIndex(
            String[] columns,
            String columnName
    ) {

        for (int i = 0; i < columns.length; i++) {

            if (
                    columns[i]
                            .trim()
                            .equals(columnName)
            ) {

                return i;
            }
        }

        throw new RuntimeException(
                "Column not found: "
                        + columnName
        );
    }
}
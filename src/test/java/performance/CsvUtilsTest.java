package performance;

import java.lang.reflect.Field;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CsvUtilsTest {

    @BeforeEach
    void setUp() throws Exception {
        resetSequentialIndex();
        System.clearProperty("feeder.file");
    }

    @AfterEach
    void tearDown() throws Exception {
        resetSequentialIndex();
        System.clearProperty("feeder.file");
    }

    @Test
    void getSequentialValueReturnsRowsInOrderAndCycles() {
        assertEquals("11", CsvUtils.getSequentialValue("ruts.csv", "userId"));
        assertEquals("22", CsvUtils.getSequentialValue("ruts.csv", "userId"));
        assertEquals("33", CsvUtils.getSequentialValue("ruts.csv", "userId"));
        assertEquals("44", CsvUtils.getSequentialValue("ruts.csv", "userId"));
        assertEquals("55", CsvUtils.getSequentialValue("ruts.csv", "userId"));
        assertEquals("11", CsvUtils.getSequentialValue("ruts.csv", "userId"));
    }

    @Test
    void getRandomValueReturnsKnownCsvValues() {
        String value = CsvUtils.getRandomValue("user.csv", "userId");

        assertTrue(Set.of("10", "20", "30", "40", "50").contains(value));
    }

    @Test
    void feederUsesConfiguredFileAndFallsBackToRandom() {
        System.setProperty("feeder.file", "user.csv");

        String value = CsvUtils.feeder("userId", "unsupported");

        assertTrue(Set.of("10", "20", "30", "40", "50").contains(value));
    }

    @Test
    void rowReturnsMappedSequentialDataAndCycles() {
        System.setProperty("feeder.file", "usuarios.csv");

        Map<String, Object> first = CsvUtils.row("sequential");
        Map<String, Object> second = CsvUtils.row("sequential");
        Map<String, Object> third = CsvUtils.row("sequential");
        Map<String, Object> cycled = CsvUtils.row("sequential");

        assertEquals(Map.of("userId", "1", "username", "Bret", "name", "Leanne Graham"), first);
        assertEquals(Map.of("userId", "2", "username", "Antonette", "name", "Ervin Howell"), second);
        assertEquals(Map.of("userId", "3", "username", "Samantha", "name", "Clementine Bauch"), third);
        assertEquals(first, cycled);
    }

    @Test
    void rowPadsMissingValuesWithEmptyStrings() {
        System.setProperty("feeder.file", "missing_values.csv");

        Map<String, Object> row = CsvUtils.row("sequential");

        assertEquals("1", row.get("id"));
        assertEquals("Alice", row.get("name"));
        assertEquals("", row.get("age"));
    }

    @Test
    void rowRandomUsesConfiguredHeaders() {
        System.setProperty("feeder.file", "usuarios.csv");

        Map<String, Object> row = CsvUtils.row("random");

        assertEquals(Set.of("userId", "username", "name"), row.keySet());
        assertTrue(Set.of("1", "2", "3").contains(row.get("userId")));
    }

    @Test
    void missingColumnWrapsTheRootCause() {
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> CsvUtils.getSequentialValue("usuarios.csv", "missing")
        );

        assertInstanceOf(RuntimeException.class, exception.getCause());
        assertTrue(exception.getCause().getMessage().contains("Column not found: missing"));
    }

    @Test
    void headerOnlyCsvWrapsTheRootCause() {
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> CsvUtils.getSequentialValue("header_only.csv", "id")
        );

        assertInstanceOf(RuntimeException.class, exception.getCause());
        assertTrue(exception.getCause().getMessage().contains("CSV has no data rows: header_only.csv"));
    }

    @Test
    void missingCsvWrapsTheRootCause() {
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> CsvUtils.getSequentialValue("missing.csv", "id")
        );

        assertInstanceOf(RuntimeException.class, exception.getCause());
        assertTrue(exception.getCause().getMessage().contains("CSV not found: missing.csv"));
    }

    private void resetSequentialIndex() throws Exception {
        Field sequentialIndex = CsvUtils.class.getDeclaredField("sequentialIndex");
        sequentialIndex.setAccessible(true);
        sequentialIndex.setInt(null, 1);
    }
}

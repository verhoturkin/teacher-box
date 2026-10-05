package ru.teacherbox.boards.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class SceneElementsTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void theNewerVersionOfEachElementWins() {
        List<ObjectNode> stored = elements("""
                [{"id":"a","version":2,"versionNonce":5},{"id":"b","version":3,"versionNonce":1},
                 {"id":"c","version":1,"versionNonce":9}]""");
        List<ObjectNode> incoming = elements("""
                [{"id":"a","version":3,"versionNonce":7,"x":10},{"id":"b","version":2,"versionNonce":0},
                 {"id":"c","version":1,"versionNonce":4,"x":1},{"id":"d","version":1,"versionNonce":1}]""");

        SceneElements.Merge merge = SceneElements.merge(stored, incoming);

        assertThat(merge.changed()).isTrue();
        assertThat(merge.elements()).extracting(element -> element.path("id").asString())
                .containsExactly("a", "b", "c", "d");
        assertThat(merge.elements().get(0).path("x").asInt()).isEqualTo(10);
        assertThat(merge.elements().get(1).path("version").asInt()).as("an older version loses").isEqualTo(3);
        assertThat(merge.elements().get(2).path("x").asInt()).as("same version: the lower nonce wins").isEqualTo(1);
    }

    @Test
    void theSameElementsChangeNothing() {
        List<ObjectNode> stored = elements("[{\"id\":\"a\",\"version\":2,\"versionNonce\":5}]");

        assertThat(SceneElements.merge(stored, stored).changed()).isFalse();
        assertThat(SceneElements.merge(stored, List.of()).elements()).hasSize(1);
    }

    @Test
    void aRestoredCopyOutranksTheCurrentScene() {
        List<ObjectNode> current = elements("""
                [{"id":"a","version":9,"versionNonce":1,"x":2},{"id":"b","version":4,"versionNonce":1},
                 {"id":"gone","version":2,"versionNonce":1,"isDeleted":true}]""");
        List<ObjectNode> copy = elements("""
                [{"id":"a","version":3,"versionNonce":1,"x":1},{"id":"old","version":1,"versionNonce":1}]""");

        List<ObjectNode> restored = SceneElements.restored(current, copy);

        assertThat(restored).extracting(element -> element.path("id").asString())
                .containsExactly("a", "old", "b", "gone");
        assertThat(restored.get(0).path("version").asInt()).isEqualTo(10);
        assertThat(restored.get(0).path("x").asInt()).isEqualTo(1);
        assertThat(restored.get(1).path("version").asInt()).isEqualTo(2);
        assertThat(restored.get(2).path("isDeleted").asBoolean()).isTrue();
        assertThat(restored.get(2).path("version").asInt()).isEqualTo(5);
        assertThat(restored.get(3).path("version").asInt()).as("a tombstone stays as it is").isEqualTo(2);
        assertThat(SceneElements.merge(current, restored).elements().getFirst().path("x").asInt()).isEqualTo(1);
    }

    @Test
    void keepsOnlyTheSharedPartOfTheAppState() {
        ObjectNode state = (ObjectNode) JSON.readTree("""
                {"viewBackgroundColor":"#fff","gridSize":20,"zoom":{"value":2},"selectedElementIds":{"a":true}}""");

        assertThat(SceneElements.appState(state).propertyNames()).containsExactlyInAnyOrder("viewBackgroundColor",
                "gridSize");
        assertThat(state.has("zoom")).as("the request is not changed").isTrue();
        assertInvalid(() -> SceneElements.appState(JSON.readTree("[]")));
    }

    @Test
    void findsTheImagesOfTheElements() {
        assertThat(SceneElements.fileIds(elements("""
                [{"id":"a","version":1,"versionNonce":1,"type":"image","fileId":"f1"},
                 {"id":"b","version":1,"versionNonce":1,"type":"image","fileId":"f2","isDeleted":true},
                 {"id":"c","version":1,"versionNonce":1,"type":"rectangle"}]"""))).containsExactly("f1", "f2");
    }

    @Test
    void rejectsElementsWithoutIdsOrVersions() {
        for (String bad : new String[] {"{}", "[1]", "[{\"version\":1,\"versionNonce\":1}]",
                "[{\"id\":\"\",\"version\":1,\"versionNonce\":1}]",
                "[{\"id\":\"" + "x".repeat(101) + "\",\"version\":1,\"versionNonce\":1}]",
                "[{\"id\":\"a\",\"version\":\"1\",\"versionNonce\":1}]", "[{\"id\":\"a\",\"version\":1}]"}) {
            assertInvalid(() -> SceneElements.valid(JSON.readTree(bad)));
        }
    }

    private static List<ObjectNode> elements(String json) {
        return SceneElements.valid(JSON.readTree(json));
    }

    private static void assertInvalid(org.assertj.core.api.ThrowableAssert.ThrowingCallable call) {
        assertThatThrownBy(call).isInstanceOfSatisfying(BusinessRuleException.class,
                e -> assertThat(e.code()).isEqualTo("boards.scene-invalid"));
    }
}

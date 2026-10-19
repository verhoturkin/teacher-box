package ru.teacherbox.homework;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.homework.application.VideoCaptions;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Captions the tests put in place of YouTube's: the first track is the suggested one; a video without them has none. */
public class FakeVideoCaptions implements VideoCaptions {

    private final Map<String, List<Captions>> captions = new HashMap<>();

    public void put(String videoId, Captions... tracks) {
        captions.put(videoId, List.of(tracks));
    }

    @Override
    public Tracks tracks(String videoId) {
        List<Captions> found = found(videoId);
        List<Track> tracks = found.stream().map(track -> new Track(track.language(), track.automatic())).toList();
        return new Tracks(found.getFirst().title(), tracks, tracks.getFirst());
    }

    @Override
    public Captions fetch(String videoId, @Nullable Track track) {
        return found(videoId).stream()
                .filter(found -> track == null
                        || found.language().equals(track.language()) && found.automatic() == track.automatic())
                .findFirst()
                .orElseThrow(FakeVideoCaptions::none);
    }

    private List<Captions> found(String videoId) {
        List<Captions> found = captions.get(videoId);
        if (found == null) {
            throw none();
        }
        return found;
    }

    private static BusinessRuleException none() {
        return new BusinessRuleException("video.captions-none", "The video has no captions");
    }
}

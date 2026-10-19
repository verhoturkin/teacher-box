package ru.teacherbox.homework;

import java.util.HashMap;
import java.util.Map;
import ru.teacherbox.homework.application.VideoCaptions;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Captions the tests put in place of YouTube's; a video without them has none. */
public class FakeVideoCaptions implements VideoCaptions {

    private final Map<String, Captions> captions = new HashMap<>();

    public void put(String videoId, Captions found) {
        captions.put(videoId, found);
    }

    @Override
    public Captions fetch(String videoId) {
        Captions found = captions.get(videoId);
        if (found == null) {
            throw new BusinessRuleException("video.captions-none", "The video has no captions");
        }
        return found;
    }
}

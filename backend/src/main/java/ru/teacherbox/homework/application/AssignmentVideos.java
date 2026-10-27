package ru.teacherbox.homework.application;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;
import ru.teacherbox.homework.application.HomeworkViews.VideoInput;
import ru.teacherbox.homework.application.HomeworkViews.VideoView;
import ru.teacherbox.homework.domain.AssignmentVideo;
import ru.teacherbox.homework.domain.VideoLink;
import ru.teacherbox.homework.persistence.VideoRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Videos of assignments by link (ADR-0047): saved with the assignment, the whole list at once. */
@Component
class AssignmentVideos {

    private final VideoRepository videos;

    AssignmentVideos(VideoRepository videos) {
        this.videos = videos;
    }

    /**
     * @throws BusinessRuleException {@code video.too-many} over 5 videos, {@code video.link-invalid} for a link that
     *                               is not http(s)
     */
    void replace(UUID assignmentId, List<VideoInput> inputs) {
        if (inputs.size() > AssignmentVideo.MAX_PER_ASSIGNMENT) {
            throw new BusinessRuleException("video.too-many",
                    "At most " + AssignmentVideo.MAX_PER_ASSIGNMENT + " videos per assignment");
        }
        List<AssignmentVideo> replaced = new ArrayList<>();
        for (VideoInput input : inputs) {
            replaced.add(new AssignmentVideo(Ids.newId(), assignmentId, replaced.size(), VideoLink.parse(input.url()),
                    input.title(), input.transcript(), input.transcriptShown()));
        }
        videos.replace(assignmentId, replaced);
    }

    /** The same videos, with their transcripts, in another assignment. */
    void copy(UUID fromAssignmentId, UUID toAssignmentId) {
        List<AssignmentVideo> copies = new ArrayList<>();
        for (AssignmentVideo video : videos.findByAssignment(fromAssignmentId)) {
            copies.add(new AssignmentVideo(Ids.newId(), toAssignmentId, video.position(), video.link(),
                    video.title(), video.transcript(), video.transcriptShown()));
        }
        videos.replace(toAssignmentId, copies);
    }

    /** As the teacher sees them: with every transcript. */
    List<VideoView> of(UUID assignmentId) {
        return videos.findByAssignment(assignmentId).stream().map(video -> VideoView.of(video, true)).toList();
    }

    /** As the student sees them: a transcript only when the teacher shows it. */
    List<VideoView> forStudent(UUID assignmentId) {
        return videos.findByAssignment(assignmentId).stream().map(video -> VideoView.of(video, false)).toList();
    }
}

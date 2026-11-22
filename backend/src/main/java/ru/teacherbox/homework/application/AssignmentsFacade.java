package ru.teacherbox.homework.application;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.homework.api.AssignmentSummary;
import ru.teacherbox.homework.api.Assignments;
import ru.teacherbox.homework.domain.Assignment;
import ru.teacherbox.homework.domain.HomeworkTask;
import ru.teacherbox.homework.persistence.AssignmentRepository;
import ru.teacherbox.homework.persistence.TaskRepository;
import ru.teacherbox.shared.error.NotFoundException;

/** Assignments for other modules: read only (roadmap 11). */
@Service
class AssignmentsFacade implements Assignments {

    private final AssignmentRepository assignments;
    private final TaskRepository tasks;

    AssignmentsFacade(AssignmentRepository assignments, TaskRepository tasks) {
        this.assignments = assignments;
        this.tasks = tasks;
    }

    @Override
    @Transactional(readOnly = true)
    public List<AssignmentSummary> find(Collection<UUID> assignmentIds) {
        List<UUID> ids = List.copyOf(new LinkedHashSet<>(assignmentIds));
        Map<UUID, Assignment> found = assignments.findByIds(ids).stream()
                .collect(Collectors.toMap(Assignment::id, Function.identity()));
        if (found.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<UUID>> studentsOf = tasks.findByAssignments(found.keySet()).stream()
                .collect(Collectors.groupingBy(HomeworkTask::assignmentId,
                        Collectors.mapping(HomeworkTask::studentId, Collectors.toList())));
        return ids.stream()
                .filter(found::containsKey)
                .map(found::get)
                .map(assignment -> new AssignmentSummary(assignment.id(), assignment.title(), assignment.dueAt(),
                        assignment.courseId(), assignment.bank(),
                        studentsOf.getOrDefault(assignment.id(), List.of())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public void checkLinkable(UUID assignmentId) {
        assignments.findById(assignmentId)
                .orElseThrow(() -> new NotFoundException("assignment.not-found", "Assignment not found"))
                .requireWorking();
    }
}

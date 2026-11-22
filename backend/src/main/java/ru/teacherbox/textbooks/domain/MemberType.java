package ru.teacherbox.textbooks.domain;

/** Who a textbook is shared with: a student, a group or the students of a course (ADR-0071). */
public enum MemberType {
    STUDENT,
    GROUP,
    COURSE
}

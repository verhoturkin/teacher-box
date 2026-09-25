package ru.teacherbox.ai.domain;

public enum RequestStatus {
    SUCCEEDED,
    FAILED,
    /** The model or its safety classifiers declined the request. */
    REFUSED
}

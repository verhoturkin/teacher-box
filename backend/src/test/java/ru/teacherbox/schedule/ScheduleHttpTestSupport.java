package ru.teacherbox.schedule;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** Common teacher HTTP requests; student and public requests stay explicit in each scenario. */
abstract class ScheduleHttpTestSupport {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    MvcTestResult get(String uri) {
        return mvc.get().uri(uri).with(teacher()).exchange();
    }

    MvcTestResult post(String uri, String body) {
        return mvc.post().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    MvcTestResult put(String uri, String body) {
        return mvc.put().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    MvcTestResult delete(String uri) {
        return mvc.delete().uri(uri).with(teacher()).exchange();
    }
}

/**
 * Billing: lesson log, payments, balances and reports.
 */
@ApplicationModule(displayName = "Billing", allowedDependencies = {"shared", "identity :: api"})
@NullMarked
package ru.teacherbox.billing;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;

# H2 scene rewrite measurement (393)

`scripts/H2FileSize.java` measures disk use when one 1 MiB (1,048,576 ASCII bytes) scene is
overwritten in 10,000 committed transactions. It reads the portal's JDBC URL, uses the real
`boards` V1 migration (including the CLOB columns), and updates the same columns as
`SceneRepository.update`. Each scene has a different version and deterministic pseudorandom text;
the experiment does not enable compression, change write delay, or shorten LOB retention.

The writer flushes with `CHECKPOINT SYNC`, records the size of every regular file in `db/`, and
closes its last connection normally. A **separate JVM** reopens that database with `IFEXISTS=TRUE`.
Both processes check the entire final scene and its version. This tests JDBC persistence and
database open/close, not HTTP autosave, Spring startup, the pool, or a full portal workload.

## Reproduce

Run from the repository root with JDK 25. H2 2.4.240 is managed by Spring Boot 4.1.1 in the
measured revision; resolve the managed version again when upgrading Boot. Allow at least 12 GiB
of free temporary disk space per run. Use a **new directory**, never a portal data directory;
the writer refuses existing paths and the reader requires an experiment marker.

```bash
mkdir -p /tmp/h2-measure/classes
curl -fsSL https://repo.maven.apache.org/maven2/com/h2database/h2/2.4.240/h2-2.4.240.jar \
  -o /tmp/h2-measure/h2.jar
javac -d /tmp/h2-measure/classes scripts/H2FileSize.java
java -Xmx768m -XX:+ExitOnOutOfMemoryError -cp /tmp/h2-measure/classes:/tmp/h2-measure/h2.jar \
  H2FileSize write /tmp/h2-measure/baseline default
java -Xmx768m -XX:+ExitOnOutOfMemoryError -cp /tmp/h2-measure/classes:/tmp/h2-measure/h2.jar \
  H2FileSize reopen /tmp/h2-measure/baseline default
java -Xmx768m -XX:+ExitOnOutOfMemoryError -cp /tmp/h2-measure/classes:/tmp/h2-measure/h2.jar \
  H2FileSize write /tmp/h2-measure/longer 5000
java -Xmx768m -XX:+ExitOnOutOfMemoryError -cp /tmp/h2-measure/classes:/tmp/h2-measure/h2.jar \
  H2FileSize reopen /tmp/h2-measure/longer 5000
```

The final optional argument is the number of saves (default 10,000); use `3` for a smoke check
and pass the same value to `reopen`. `default` uses the URL unchanged; a number overrides only
`MAX_COMPACT_TIME`. Keep the two full runs sequential so they do not compete for disk bandwidth.
The harness deliberately does not assert exact sizes or times: chunk reuse and background work
depend on timing. Linux `VmHWM` is process peak RSS in KiB; `max_heap_bytes` is the configured
heap ceiling. Cgroup metrics describe the enclosing cgroup, including its file cache and any
other processes, rather than just this JVM.

For a container check, mount the repository read-only at `/work`, the compiled classes and H2
jar at `/measure`, and an empty writable results directory at `/results`. Run each phase in a
separate `eclipse-temurin:25-jdk` container with `--memory=1g --memory-swap=1g`, working directory
`/work`, the same `-Xmx768m` flags and classpath `/measure/classes:/measure/h2.jar`. First confirm
that `/sys/fs/cgroup/memory.max` inside the container is **1073741824**. An accepted Docker option
alone is not proof of an enforced limit. A production validation must also measure the complete
portal startup and shutdown with its usual data under that limit.

## Baseline result (2026-11-15)

Linux x86-64, Temurin 25.0.5, H2 2.4.240, `-Xmx768m`, the default async JDBC URL from
`application.yaml`. A new directory was used for every run. Sizes below are logical file bytes,
not allocated filesystem blocks.

| Metric | Default (`MAX_COMPACT_TIME=200`) |
|---|---:|
| Initial `db/` | 24,576 bytes |
| After 10,000 saves and checkpoint, before close | 10,671,181,824 bytes |
| After normal close | 12,906,496 bytes |
| After reopen in a new JVM | 12,906,496 bytes |
| After that JVM closes | 1,097,728 bytes |
| Saves including final checkpoint | 42,135 ms |
| Writer close | 464 ms |
| Database reopen | 658 ms |
| Writer peak RSS | 994,840 KiB |
| Reader peak RSS | 89,676 KiB |

Both final-scene checks passed. A preliminary Java 21 source-launch run also preserved the scene
and shrank roughly 10 GB to 14 MB, but is not the reference above. A preliminary Docker run with
`MaxRAMPercentage=75` was **not memory constrained**: Docker recorded a 1 GiB limit, while
`memory.max` inside was 8 GiB and the JVM used that larger limit. It is excluded from the table.
The reference instead fixes the heap explicitly. Its observed writer RSS fits below 1 GiB with
little headroom; this is not evidence that the complete Spring application fits under that limit.
Full portal startup and shutdown under an enforced 1 GiB limit remain unverified in this
environment.

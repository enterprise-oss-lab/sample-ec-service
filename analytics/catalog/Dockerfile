FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /src
# Iceberg 1.12.0 release commit; published fixture tags stop at 1.10.1.
RUN git init . && git remote add origin https://github.com/apache/iceberg.git && \
    git fetch --depth=1 origin 212aa894e919ff9fdf89160da4aadcbe6858ac01 && \
    git checkout --detach FETCH_HEAD
RUN --mount=type=cache,target=/root/.gradle printf '1.12.0\n' > version.txt && \
    ./gradlew --no-daemon --console=plain --info --max-workers=2 -Dorg.gradle.jvmargs=-Xmx1024m :iceberg-open-api:shadowJar

FROM eclipse-temurin:17-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --gid 1000 iceberg && useradd --uid 1000 --gid 1000 --create-home iceberg
WORKDIR /usr/lib/iceberg-rest
COPY --from=build /src/open-api/build/libs/iceberg-open-api-test-fixtures-runtime-1.12.0.jar iceberg-rest-adapter.jar
USER iceberg
EXPOSE 8181
CMD ["java", "-jar", "iceberg-rest-adapter.jar"]

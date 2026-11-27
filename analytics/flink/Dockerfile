FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
COPY src src
RUN mvn -B package

FROM flink:1.20.1-scala_2.12-java17
COPY --from=build /build/target/confirmed-sales-1.0.0.jar /opt/flink/usrlib/confirmed-sales.jar
USER root
RUN mkdir -p /opt/flink/checkpoints && chown flink:flink /opt/flink/checkpoints
USER flink

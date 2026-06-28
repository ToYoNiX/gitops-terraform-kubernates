FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
COPY src ./src
RUN mvn package -DskipTests -q

FROM eclipse-temurin:17-jdk-alpine AS jlink
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
RUN jar xf app.jar && \
    jdeps \
      --ignore-missing-deps \
      --print-module-deps \
      --multi-release 17 \
      --recursive \
      --class-path 'BOOT-INF/lib/*' \
      app.jar > modules.txt && \
    jlink \
      --no-header-files \
      --no-man-pages \
      --compress=2 \
      --strip-debug \
      --add-modules "$(cat modules.txt)" \
      --output /custom-jre

FROM alpine:3.19
WORKDIR /app
COPY --from=jlink /custom-jre /opt/jre
COPY --from=build /app/target/*.jar app.jar
ENV PATH="/opt/jre/bin:$PATH" \
    JAVA_HOME="/opt/jre"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

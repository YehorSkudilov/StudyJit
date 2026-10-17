# The StudyJit API.
#   docker build -t studyjit-api StudyJit.Api
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

# yt-dlp downloads YouTube videos and ffmpeg merges their video and audio (see Files/YouTubeDownloader.cs). The
# standalone yt-dlp build needs no Python; Npgsql loads GSSAPI for Kerberos auth, and without it startup logs a
# missing-library error.
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/* \
    && if [ "$TARGETARCH" = "arm64" ]; then YTDLP=yt-dlp_linux_aarch64; else YTDLP=yt-dlp_linux; fi \
    && curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$YTDLP" -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && yt-dlp --version

# Uploaded files (a volume, see docker-compose.yml). Owned by the app's user so a new volume is writable.
RUN mkdir -p /shared-files && chown "$APP_UID" /shared-files

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["StudyJit.Api.csproj", "./"]
RUN dotnet restore "StudyJit.Api.csproj"

COPY . .
RUN dotnet publish "StudyJit.Api.csproj" -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "StudyJit.Api.dll"]

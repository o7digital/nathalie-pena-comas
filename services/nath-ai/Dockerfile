ARG OLIVIA_BASE_IMAGE=olivia-v3-olivia-v3
FROM ${OLIVIA_BASE_IMAGE}
WORKDIR /app
# core/ is recovered on the VPS from Olivia 3.6 revision 3453702, never from client credentials.
COPY core/app/ app/
COPY gateway.py app/nath_gateway.py
COPY knowledge_protocol.py knowledge_runtime.py app/
COPY knowledge/ knowledge/
ENV CHAT_SYSTEM_INSTRUCTIONS_FILE=/app/knowledge/system.txt PYTHONDONTWRITEBYTECODE=1 TZ=America/Mexico_City
EXPOSE 8093
CMD ["uvicorn","app.nath_gateway:app","--host","0.0.0.0","--port","8093","--workers","1","--no-access-log"]

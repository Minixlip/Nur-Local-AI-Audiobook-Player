# -*- coding: utf-8 -*-
from nur_tts_backend.app import app


if __name__ == '__main__':
    import uvicorn

    uvicorn.run(app, host='127.0.0.1', port=8000)

# LSB EV Parking Spots

A web app to view the latest snapshot of EV parking spots at LSB.

## Features

- View each station's current status per plug.
- Filter parking spots by faculty or general/students.
- Sort parking spots by name or availability.
- Receive instant updates over WebSockets.
- Fall back to polling every 15 seconds while WebSockets are disconnected.
- View the connection mode and last refreshed time.
- Mobile-ish friendly.

## Configuration

Set `VITE_API_BASE_URL` to the HTTP base URL of `lsb-parking-api`. The frontend
automatically derives the corresponding `ws:` or `wss:` URL. It defaults to
`https://lsb-api.compiles.me`.

## Docker

Build and run the production nginx image:

```sh
docker build \
  --build-arg VITE_API_BASE_URL=https://lsb-api.compiles.me \
  -t lsb-parking-frontend .
docker run --rm -p 8080:80 lsb-parking-frontend
```

`VITE_API_BASE_URL` is embedded by Vite at image build time. The final image
contains only nginx and the compiled static assets; Node.js and source files stay
in the build stage.

## Hosted Link

- [https://lsb.compiles.me](https://lsb.compiles.me)

## API Reference

- [https://lsb-api.compiles.me/docs](https://lsb-api.compiles.me/docs)

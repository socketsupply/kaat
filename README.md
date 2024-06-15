# Kaat

## Setup

### Rebuild Socket using next branch 

- Clone or pull [@socketsupply/socket](https://github.com/socketsupply/socket) on the `next` branch and run install.

```
./bin/install.sh
```

### Build and run the app
In this repository:

#### Desktop

```
ssc build -r
```

#### Mobile

```
ssc build -c -p --platform=ios && ssc install-app --platform=ios
```

### Run tests

```
npm test
```

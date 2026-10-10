/// Points at the deployed RLTS-MM web app's API (same backend the web portal talks to
/// — see B2_Assignment5/rlts-myanmar/src/app/api/*). Change this if the backend moves.
///
/// Using the raw IP over plain HTTP (not HTTPS) matches the web app's own deployment
/// choice: see rlts-myanmar/DEPLOY.md for why a domain + TLS wasn't worth the setup time
/// against the deadline. AndroidManifest.xml sets usesCleartextTraffic="true" to allow it.
const String kApiBaseUrl = "http://136.85.81.202:3000/api";

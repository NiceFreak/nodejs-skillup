# Day 2 English Speaking Practice

## Topic

Designing safe MongoDB integration tests for local development and CI

## Speaking Script

Today I worked on making MongoDB integration tests consistent locally and in CI. Locally, tests fall back to MongoMemoryServer, while CI must receive MONGODB_URI and fail fast if it is missing. Running Jest serially does not create database isolation. Two suites can still leave conflicting users or clean up each other's data. My design gives each suite its own logical database under a verified skillup_test namespace, with validation before any connection or fixture write. Earlier, both database modes passed their assertions, but a cleanup check found that one test database still existed afterward. That showed me that green tests are not enough; teardown state is also part of correctness. I also found that separate Mongoose connections introduce model ownership questions, because a model registered on one connection is not automatically available on another. My remaining task is to make that ownership explicit and repeat the full cleanup verification.

## Speaking Check

- Word count: 148 words
- Estimated speaking time: about 61-68 seconds at 130-145 words per minute
- Tone check: conversational, evidence-based, and honest about the remaining verification gap
- Pronunciation: `isolation` /eye-suh-LAY-shun/; `lifecycle` /LIFE-sy-kul/; say `MONGODB_URI` as "MongoDB U-R-I"

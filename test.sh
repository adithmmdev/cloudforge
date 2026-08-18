#!/bin/sh
set -e

VARS=$(echo "" | grep "foo" || true)

for var in $VARS; do
    echo "Found: $var"
done

echo "Done"

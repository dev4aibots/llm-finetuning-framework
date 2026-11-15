.PHONY: test run report check

# Stdlib only: no virtualenv, no requirements file, no network.
test:
	python -m unittest discover -s tests -t . -v

run:
	python main.py

report:
	python main.py --json

# What CI runs: the suite, then a byte-for-byte reproducibility check.
check: test
	python main.py --json > first.json
	python main.py --json > second.json
	diff first.json second.json
	rm first.json second.json

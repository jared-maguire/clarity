VERSION := $(shell jq -r .version manifest.json)
DIST_DIR := dist
ZIP_NAME := clarity-$(VERSION).zip

SRC_FILES := manifest.json \
	$(wildcard src/background/*.js) \
	$(wildcard src/content/*.js) \
	$(wildcard src/popup/*) \
	$(wildcard styles/*.css) \
	$(wildcard icons/*.png)

.PHONY: dist clean

dist: $(DIST_DIR)/$(ZIP_NAME)

$(DIST_DIR)/$(ZIP_NAME): $(SRC_FILES)
	@mkdir -p $(DIST_DIR)
	@rm -f $@
	zip -r $@ $(SRC_FILES)
	@echo "Built $@ ($(shell du -h $@ 2>/dev/null | cut -f1 || echo '?'))"

clean:
	rm -rf $(DIST_DIR)

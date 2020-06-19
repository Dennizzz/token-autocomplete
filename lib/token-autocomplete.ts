interface Token {
    value: string,
    text: string,
    type: string | null
}

interface Suggestion {
    id: string | null,
    value: string,
    text: string,
    type: string | null,
    description: string | null
}

interface Options {
    name: string,
    selector: string,
    noMatchesText: string | null,
    placeholderText: string | null,
    initialTokens: Array<Token> | null,
    initialSuggestions: Array<Suggestion> | null,
    selectMode: SelectModes,
    suggestionsUri: string,
    suggestionsUriBuilder: SuggestionUriBuilder,
    suggestionRenderer: SuggestionRenderer,
    minCharactersForSuggestion: number
}

enum SelectModes {
    SINGLE, MULTI, SEARCH
}

interface SelectMode {
    handleInputAsValue(input: string): void;

    clear(): void;
}

interface SingleSelect extends SelectMode {
}

interface MultiSelect extends SelectMode {
    addToken(suggestionValue: string | null, suggestionText: string | null, suggestionType: string | null): void;

    removeToken(token: HTMLSpanElement): void;

    removeLastToken(): void;

    removeTokenWithText(textContent: any): void;
}

interface Autocomplete {
    suggestions: any;

    requestSuggestions(value: string): void;

    highlightSuggestionAtPosition(arg0: number): void;

    addSuggestion(suggestion: Suggestion): void;

    clearSuggestions(): void;

    hideSuggestions(): void;

    highlightSuggestion(arg0: Element): void;
}

interface SuggestionRenderer {
    (suggestion: Suggestion): HTMLElement;
}

interface SuggestionUriBuilder {
    (query: string): string;
}

class TokenAutocomplete {

    KEY_BACKSPACE = 'Backspace';
    KEY_ENTER = 'Enter';
    KEY_TAB = 'Tab';
    KEY_UP = 'ArrowUp';
    KEY_DOWN = 'ArrowDown';

    options: Options;
    container: any;
    hiddenSelect: HTMLSelectElement;
    textInput: HTMLSpanElement;

    select: MultiSelect;
    autocomplete: Autocomplete;

    defaults: Options = {
        name: '',
        selector: '',
        noMatchesText: null,
        placeholderText: 'enter some text',
        initialTokens: null,
        initialSuggestions: null,
        suggestionsUri: '',
        selectMode: SelectModes.MULTI,
        suggestionsUriBuilder: function (query) {
            return this.suggestionsUri + '?query=' + query
        },
        suggestionRenderer: TokenAutocomplete.Autocomplete.defaultRenderer,
        minCharactersForSuggestion: 1
    };
    log: any;

    constructor(options: Options) {
        this.options = {...this.defaults, ...options};

        let passedContainer = document.querySelector(this.options.selector);
        if (!passedContainer) {
            throw new Error('passed selector does not point to a DOM element.');
        }

        this.container = passedContainer;
        this.container.classList.add('token-autocomplete-container');

        if (!Array.isArray(this.options.initialTokens) && !Array.isArray(this.options.initialSuggestions)) {
            this.parseTokensAndSuggestions();
        }

        this.hiddenSelect = document.createElement('select');
        this.hiddenSelect.id = this.container.id + '-select';
        this.hiddenSelect.name = this.options.name;
        this.hiddenSelect.setAttribute('multiple', 'true');
        this.hiddenSelect.style.display = 'none';

        this.textInput = document.createElement('span');
        this.textInput.id = this.container.id + '-input';
        this.textInput.classList.add('token-autocomplete-input');
        if (this.options.placeholderText != null) {
            this.textInput.dataset.placeholder = this.options.placeholderText;
        }
        this.textInput.contentEditable = 'true';

        this.container.appendChild(this.textInput);
        this.container.appendChild(this.hiddenSelect);

        if (this.options.selectMode == SelectModes.MULTI) {
            this.select = new TokenAutocomplete.MultiSelect(this);
        } else if (this.options.selectMode == SelectModes.SEARCH) {
            this.select = new TokenAutocomplete.SearchMultiSelect(this);
        }
        this.autocomplete = new TokenAutocomplete.Autocomplete(this);

        this.debug(false);

        let me = this;

        this.textInput.addEventListener('keydown', function (event) {
            if (event.key == me.KEY_ENTER || event.key == me.KEY_TAB) {
                event.preventDefault();

                let highlightedSuggestion = me.autocomplete.suggestions.querySelector('.token-autocomplete-suggestion-highlighted');
                if (highlightedSuggestion !== null) {
                    if (highlightedSuggestion.classList.contains('token-autocomplete-suggestion-active')) {
                        me.select.removeTokenWithText(highlightedSuggestion.dataset.text);
                    } else {
                        me.select.addToken(highlightedSuggestion.dataset.value, highlightedSuggestion.dataset.text, highlightedSuggestion.dataset.type);
                    }
                    me.clearCurrentInput();
                } else {
                    me.select.handleInputAsValue(me.getCurrentInput());
                }
            } else if (me.getCurrentInput() === '' && event.key == me.KEY_BACKSPACE) {
                event.preventDefault();
                me.select.removeLastToken();
            }
        });

        this.textInput.addEventListener('keyup', function (event) {
            if (event.key == me.KEY_UP && me.autocomplete.suggestions.childNodes.length > 0) {
                let highlightedSuggestion = me.autocomplete.suggestions.querySelector('.token-autocomplete-suggestion-highlighted');
                let aboveSuggestion = highlightedSuggestion?.previousSibling;
                if (aboveSuggestion != null) {
                    me.autocomplete.highlightSuggestion(aboveSuggestion as Element);
                }
                return;
            }
            if (event.key == me.KEY_DOWN && me.autocomplete.suggestions.childNodes.length > 0) {
                let highlightedSuggestion = me.autocomplete.suggestions.querySelector('.token-autocomplete-suggestion-highlighted');
                let belowSuggestion = highlightedSuggestion?.nextSibling;
                if (belowSuggestion != null) {
                    me.autocomplete.highlightSuggestion(belowSuggestion as Element);
                }
                return;
            }

            me.autocomplete.hideSuggestions();
            me.autocomplete.clearSuggestions();

            let value = me.getCurrentInput();
            if (value.length >= me.options.minCharactersForSuggestion) {
                if (Array.isArray(me.options.initialSuggestions)) {
                    me.options.initialSuggestions.forEach(function (suggestion) {
                        if (typeof suggestion !== 'object') {
                            // the suggestion is of wrong type and therefore ignored
                            return;
                        }
                        if (value.localeCompare(suggestion.text.slice(0, value.length), undefined, {sensitivity: 'base'}) === 0) {
                            // The suggestion starts with the query text the user entered and will be displayed
                            me.autocomplete.addSuggestion(suggestion);
                        }
                    });
                    if (me.autocomplete.suggestions.childNodes.length > 0) {
                        me.autocomplete.highlightSuggestionAtPosition(0);
                    } else if (me.options.noMatchesText) {
                        me.autocomplete.addSuggestion({
                            id: null,
                            value: '_no_match_',
                            text: me.options.noMatchesText,
                            type: '_no_match_',
                            description: null
                        });
                    }
                } else if (me.options.suggestionsUri.length > 0) {
                    me.autocomplete.requestSuggestions(value);
                }
            }
        });

        this.container.tokenAutocomplete = this as TokenAutocomplete;
    }

    /**
     * Searches the element given as a container for option elements and creates active tokens (when the option is marked selected)
     * and suggestions (all options found) from these. During this all found options are removed from the DOM.
     */
    parseTokensAndSuggestions() {
        let initialTokens: Array<Token> = [];
        let initialSuggestions: Array<Suggestion> = [];

        let options: NodeListOf<HTMLOptionElement> = this.container.querySelectorAll('option');

        let me = this;
        options.forEach(function (option) {
            if (option.text != null) {
                if (option.hasAttribute('selected')) {
                    initialTokens.push({value: option.value, text: option.text, type: null});
                }
                initialSuggestions.push({
                    id: null,
                    value: option.value,
                    text: option.text,
                    type: null,
                    description: null
                });
            }
            me.container.removeChild(option);
        });

        if (initialTokens.length > 0) {
            this.options.initialTokens = initialTokens;
        }
        if (initialSuggestions.length > 0) {
            this.options.initialSuggestions = initialSuggestions;
        }

        if (Array.isArray(this.options.initialTokens)) {
            this.options.initialTokens.forEach(function (token) {
                if (typeof token === 'object') {
                    me.select.addToken(token.value, token.text, null);
                }
            });
        }
    }

    /**
     * Clears the currently present tokens and creates new ones from the given input value.
     *
     * @param {(Array<Token>|string)} value - either the name of a single token or a list of tokens to create
     */
    val(value: Array<Token> | Token) {
        this.select.clear();

        if (Array.isArray(value)) {
            let me = this;
            value.forEach(function (token) {
                if (typeof token === 'object') {
                    me.select.addToken(token.value, token.text, null);
                }
            });
        } else {
            this.select.addToken(value.value, value.text, null);
        }
    }

    /**
     * Returns the current text the user has input which is not converted into a token.
     */
    getCurrentInput() {
        return this.textInput.textContent || '';
    }

    clearCurrentInput() {
        this.textInput.textContent = '';
    }

    debug(state: boolean) {
        if (state) {
            this.log = console.log.bind(window.console);
        } else {
            this.log = function () {
            }
        }
    }

    static MultiSelect = class implements MultiSelect {

        parent: TokenAutocomplete;
        container: any;
        options: Options;

        constructor(parent: TokenAutocomplete) {
            this.parent = parent;
            this.container = parent.container;
            this.options = parent.options;
        }

        /**
         * Adds the current user input as a net token and resets the input area so new text can be entered.
         *
         * @param {string} input - the actual input the user entered
         */
        handleInputAsValue(input: string): void {
            this.addToken(input, input, null);
            this.parent.clearCurrentInput();
        }

        /**
         * Adds a token with the specified name to the list of currently present tokens displayed to the user and the hidden select.
         *
         * @param {string} tokenValue - the actual value of the token to create
         * @param {string} tokenText - the name of the token to create
         * @param {string} tokenType - the type of the token to create
         */
        addToken(tokenValue: string | null, tokenText: string | null, tokenType: string | null) {
            if (tokenValue === null || tokenText === null) {
                return;
            }
            let option = document.createElement('option');
            option.text = tokenText;
            option.value = tokenValue;
            option.setAttribute('selected', 'true');
            option.dataset.text = tokenText;
            option.dataset.value = tokenValue;
            if (tokenType != null) {
                option.dataset.type = tokenType;
            }
            this.parent.hiddenSelect.add(option);

            let token = document.createElement('span');
            token.classList.add('token-autocomplete-token');
            token.dataset.text = tokenText;
            token.dataset.value = tokenValue;
            if (tokenType != null) {
                token.dataset.type = tokenType;
            }
            token.textContent = tokenText;

            let deleteToken = document.createElement('span');
            deleteToken.classList.add('token-autocomplete-token-delete');
            deleteToken.textContent = '\u00D7';
            token.appendChild(deleteToken);

            let me = this;
            deleteToken.addEventListener('click', function () {
                me.removeToken(token);
            });

            this.container.insertBefore(token, this.parent.textInput);

            let addedToken = {
                value: tokenValue,
                text: tokenText,
                type: tokenType
            };
            this.container.dispatchEvent(new CustomEvent('tokens-changed', {
                detail: {
                    tokens: this.currentTokens(),
                    added: addedToken
                }
            }));

            this.parent.log('added token', token);
        }

        /**
         * Completely clears the currently present tokens from the field.
         */
        clear() {
            let tokens: NodeListOf<HTMLElement> = this.container.querySelectorAll('.token-autocomplete-token');

            let me = this;
            tokens.forEach(function (token) {
                me.removeToken(token);
            });
        }

        /**
         * Removes the last token in the list of currently present token. This is the last added token next to the input field.
         */
        removeLastToken() {
            let tokens = this.container.querySelectorAll('.token-autocomplete-token');
            let token = tokens[tokens.length - 1];
            this.removeToken(token);
        }

        /**
         * Removes the specified token from the list of currently present tokens.
         *
         * @param {Element} token - the token to remove
         */
        removeToken(token: HTMLElement) {
            this.container.removeChild(token);

            let tokenText = token.dataset.text;
            let hiddenOption = this.parent.hiddenSelect.querySelector('option[data-text="' + tokenText + '"]');
            hiddenOption?.parentElement?.removeChild(hiddenOption);

            let addedToken = {
                value: token.dataset.value,
                text: tokenText,
                type: token.dataset.type
            }
            this.container.dispatchEvent(new CustomEvent('tokens-changed', {
                detail: {
                    tokens: this.currentTokens(),
                    removed: addedToken
                }
            }));

            this.parent.log('removed token', token.textContent);
        }

        removeTokenWithText(tokenText: string | null) {
            if (tokenText === null) {
                return;
            }
            let token = this.container.querySelector('.token-autocomplete-token[data-text="' + tokenText + '"]');
            if (token !== null) {
                this.removeToken(token);
            }
        }

        currentTokens() {
            let tokens: string[] = [];
            this.parent.hiddenSelect.querySelectorAll('option').forEach(function (option) {
                if (option.dataset.value != null) {
                    tokens.push(option.dataset.value);
                }
            })
            return tokens;
        }
    }

    static SearchMultiSelect = class extends TokenAutocomplete.MultiSelect {
        /**
         * Instead of adding the custom user input as a token and handling it as a filter we let it remain in the input
         * area and instead send an event so the user search request can be handled / executed.
         *
         * @param {string} input - the actual input the user entered
         */
        handleInputAsValue(input: string) {
            this.container.dispatchEvent(new CustomEvent('query-changed', {
                detail: {
                    query: input
                }
            }));
        }
    }

    static Autocomplete = class implements Autocomplete {

        parent: TokenAutocomplete;
        container: any;
        options: Options;
        suggestions: HTMLUListElement;
        renderer: SuggestionRenderer;

        constructor(parent: TokenAutocomplete) {
            this.parent = parent;
            this.container = parent.container;
            this.options = parent.options;
            this.renderer = parent.options.suggestionRenderer;

            this.suggestions = document.createElement('ul');
            this.suggestions.id = this.container.id + '-suggestions';
            this.suggestions.classList.add('token-autocomplete-suggestions');

            this.container.appendChild(this.suggestions);
        }

        /**
         * Hides the suggestions dropdown from the user.
         */
        hideSuggestions() {
            this.suggestions.style.display = '';
        }

        /**
         * Shows the suggestions dropdown to the user.
         */
        showSuggestions() {
            this.suggestions.style.display = 'block';
        }

        highlightSuggestionAtPosition(index: number) {
            let suggestions = this.suggestions.querySelectorAll('li');
            suggestions.forEach(function (suggestion) {
                suggestion.classList.remove('token-autocomplete-suggestion-highlighted');
            })
            suggestions[index].classList.add('token-autocomplete-suggestion-highlighted');
        }

        highlightSuggestion(suggestion: Element) {
            this.suggestions.querySelectorAll('li').forEach(function (suggestion) {
                suggestion.classList.remove('token-autocomplete-suggestion-highlighted');
            })
            suggestion.classList.add('token-autocomplete-suggestion-highlighted');
        }

        /**
         * Removes all previous suggestions from the dropdown.
         */
        clearSuggestions() {
            this.suggestions.innerHTML = '';
        }

        /**
         * Loads suggestions matching the given query from the rest service behind the URI given as an option while initializing the field.
         *
         * @param query the query to search suggestions for
         */
        requestSuggestions(query: string) {
            let me = this;
            let request = new XMLHttpRequest();
            request.onload = function () {
                if (Array.isArray(request.response.completions)) {
                    request.response.completions.forEach(function (suggestion: Suggestion) {
                        me.addSuggestion(suggestion);
                    });
                    if (me.suggestions.childNodes.length > 0) {
                        me.highlightSuggestionAtPosition(0);
                    } else if (me.options.noMatchesText) {
                        me.addSuggestion({
                            id: null,
                            value: '_no_match_',
                            text: me.options.noMatchesText,
                            type: '_no_match_',
                            description: null
                        });
                    }
                }
            };
            let suggestionsUri = me.options.suggestionsUriBuilder(query);
            request.open('GET', suggestionsUri, true);
            request.responseType = 'json';
            request.setRequestHeader('Content-type', 'application/json');
            request.send();
        }

        /**
         * Adds a suggestion with the given text matching the users input to the dropdown.
         *
         * @param {string} suggestion - the metadata of the suggestion that should be added
         */
        addSuggestion(suggestion: Suggestion) {
            let element = this.renderer(suggestion);

            let value = suggestion.id || suggestion.value;

            element.dataset.value = value;
            element.dataset.text = suggestion.text;
            if (suggestion.type != null) {
                element.dataset.type = suggestion.type;
            }

            let me = this;
            element.addEventListener('click', function (_event: Event) {
                if (suggestion.text == me.options.noMatchesText) {
                    return true;
                }

                if (element.classList.contains('token-autocomplete-suggestion-active')) {
                    me.parent.select.removeTokenWithText(suggestion.text);
                } else {
                    me.parent.select.addToken(value, suggestion.text, suggestion.type);
                }
                me.clearSuggestions();
                me.hideSuggestions();
                me.parent.clearCurrentInput();
            });

            if (this.container.querySelector('.token-autocomplete-token[data-text="' + suggestion.text + '"]') !== null) {
                element.classList.add('token-autocomplete-suggestion-active');
            }

            this.suggestions.appendChild(element);
            this.showSuggestions();

            me.parent.log('added suggestion', suggestion);
        }

        static defaultRenderer: SuggestionRenderer = function (suggestion: Suggestion): HTMLElement {
            let option = document.createElement('li');
            option.textContent = suggestion.text;

            if (suggestion.description) {
                let description = document.createElement('small');
                description.textContent = suggestion.description;
                description.classList.add('token-autocomplete-suggestion-description');
                option.appendChild(description);
            }

            return option;
        }
    }
}
"""Test the unified boolean search parser."""

def _tokenize_search(q_str):
    tokens = []
    i = 0
    while i < len(q_str):
        if q_str[i] in ' \t':
            i += 1
        elif q_str[i] == '(':
            tokens.append(('OP', '('))
            i += 1
        elif q_str[i] == ')':
            tokens.append(('OP', ')'))
            i += 1
        elif q_str[i:i+2] == '&&':
            tokens.append(('OP', '&&'))
            i += 2
        elif q_str[i:i+2] == '||':
            tokens.append(('OP', '||'))
            i += 2
        elif q_str[i] == '!' and i + 1 < len(q_str) and q_str[i+1] in '#(':
            tokens.append(('OP', '!'))
            i += 1
        elif q_str[i] == '!':
            i += 1
            while i < len(q_str) and q_str[i] in ' \t':
                i += 1
            if i < len(q_str) and q_str[i] == '(':
                tokens.append(('OP', '!'))
            elif i < len(q_str) and q_str[i] not in '()&|':
                j = i
                while j < len(q_str) and q_str[j] not in ' \t()&|':
                    j += 1
                tokens.append(('OP', '!'))
                tokens.append(('TEXT', q_str[i:j]))
                i = j
            else:
                tokens.append(('OP', '!'))
        elif q_str[i] == '#':
            j = i + 1
            while j < len(q_str) and q_str[j] not in ' \t()&|!':
                j += 1
            if j > i + 1:
                tokens.append(('TAG', q_str[i+1:j]))
            i = j
        else:
            j = i
            while j < len(q_str) and q_str[j] not in ' \t()&|!#':
                j += 1
            if j > i:
                tokens.append(('TEXT', q_str[i:j]))
            i = j
    return tokens

def _parse_search_ast(tokens):
    pos = [0]
    def peek():
        return tokens[pos[0]] if pos[0] < len(tokens) else None
    def consume():
        t = tokens[pos[0]] if pos[0] < len(tokens) else None
        pos[0] += 1
        return t
    def parse_expr():
        left = parse_and_expr()
        while peek() and peek() == ('OP', '||'):
            consume()
            right = parse_and_expr()
            left = ('or', left, right)
        return left
    def parse_and_expr():
        left = parse_unary()
        while True:
            p = peek()
            if p and p == ('OP', '&&'):
                consume()
                right = parse_unary()
                left = ('and', left, right)
            elif p and p not in (('OP', '||'), ('OP', ')')):
                right = parse_unary()
                left = ('and', left, right)
            else:
                break
        return left
    def parse_unary():
        if peek() == ('OP', '!'):
            consume()
            operand = parse_unary()
            return ('not', operand)
        return parse_atom()
    def parse_atom():
        p = peek()
        if p == ('OP', '('):
            consume()
            node = parse_expr()
            if peek() == ('OP', ')'):
                consume()
            return node
        t = consume()
        if t is None:
            return ('text', '')
        if t[0] == 'TAG':
            return ('tag', t[1])
        if t[0] == 'TEXT':
            return ('text', t[1])
        return ('text', '')
    if not tokens:
        return None
    return parse_expr()

def _tag_matches_token(token, tag_list):
    for t in tag_list:
        if t == token or t.startswith(token + '/'):
            return True
        segments = t.split('/')
        if token in segments:
            return True
    return False

def _text_matches(term, searchable_text):
    return term in searchable_text

def _eval_search_ast(node, tag_list_lower, searchable_text):
    if node is None:
        return True
    kind = node[0]
    if kind == 'tag':
        return _tag_matches_token(node[1], tag_list_lower)
    elif kind == 'text':
        return _text_matches(node[1], searchable_text)
    elif kind == 'and':
        return _eval_search_ast(node[1], tag_list_lower, searchable_text) and \
               _eval_search_ast(node[2], tag_list_lower, searchable_text)
    elif kind == 'or':
        return _eval_search_ast(node[1], tag_list_lower, searchable_text) or \
               _eval_search_ast(node[2], tag_list_lower, searchable_text)
    elif kind == 'not':
        return not _eval_search_ast(node[1], tag_list_lower, searchable_text)
    return True

def run(query, tags, text, expected):
    tokens = _tokenize_search(query.lower())
    ast = _parse_search_ast(tokens)
    result = _eval_search_ast(ast, tags, text)
    status = 'PASS' if result == expected else 'FAIL'
    print(f'{status} | {query:45s} -> {result} (expected {expected})')
    return result == expected

all_pass = True
# Tag tests
all_pass &= run('#work #urgent', ['work', 'urgent'], '', True)
all_pass &= run('#work #urgent', ['work'], '', False)
all_pass &= run('#work || #personal', ['personal'], '', True)
all_pass &= run('#work || #personal', ['other'], '', False)
all_pass &= run('!#done', ['work'], '', True)
all_pass &= run('!#done', ['done'], '', False)
all_pass &= run('(#work || #personal) && !#done', ['work'], '', True)
all_pass &= run('(#work || #personal) && !#done', ['work', 'done'], '', False)
all_pass &= run('#parent', ['parent/child'], '', True)

# Text tests
all_pass &= run('meeting', [], 'meeting with bob', True)
all_pass &= run('meeting', [], 'lunch with bob', False)
all_pass &= run('meeting || lunch', [], 'lunch with bob', True)
all_pass &= run('meeting || lunch', [], 'dinner with bob', False)
all_pass &= run('el !hello', [], 'elizabeth went home', True)  # has "el", no "hello"
all_pass &= run('el !hello', [], 'hello elizabeth', False)     # has "el" but also "hello"
all_pass &= run('!(hello)', [], 'goodbye world', True)         # no "hello"
all_pass &= run('!(hello)', [], 'hello world', False)          # has "hello"

# Mixed tag + text
all_pass &= run('#work meeting', ['work'], 'meeting at 3pm', True)
all_pass &= run('#work meeting', ['work'], 'lunch at noon', False)
all_pass &= run('#work meeting', ['personal'], 'meeting at 3pm', False)

# Complex
all_pass &= run('(meeting || lunch) && #work && !cancelled', ['work'], 'lunch tomorrow', True)
all_pass &= run('(meeting || lunch) && #work && !cancelled', ['work'], 'lunch cancelled', False)

print(f'\n{"All tests passed!" if all_pass else "SOME TESTS FAILED"}')

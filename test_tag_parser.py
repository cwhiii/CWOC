import re

def _tokenize_tag_expr(expr):
    tokens = []
    i = 0
    while i < len(expr):
        if expr[i] in ' \t':
            i += 1
        elif expr[i] == '(':
            tokens.append('(')
            i += 1
        elif expr[i] == ')':
            tokens.append(')')
            i += 1
        elif expr[i] == '!' and (i + 1 >= len(expr) or expr[i + 1] != '='):
            tokens.append('!')
            i += 1
        elif expr[i:i+2] == '&&':
            tokens.append('&&')
            i += 2
        elif expr[i:i+2] == '||':
            tokens.append('||')
            i += 2
        elif expr[i] == '#':
            j = i + 1
            while j < len(expr) and expr[j] not in ' \t()!&|':
                j += 1
            tokens.append(expr[i:j])
            i = j
        else:
            i += 1
    return tokens

def _parse_tag_ast(tokens):
    pos = [0]
    def peek():
        return tokens[pos[0]] if pos[0] < len(tokens) else None
    def consume(expected=None):
        t = tokens[pos[0]] if pos[0] < len(tokens) else None
        if expected and t != expected:
            return None
        pos[0] += 1
        return t
    def parse_expr():
        left = parse_and_expr()
        while peek() == '||':
            consume('||')
            right = parse_and_expr()
            left = ('or', left, right)
        return left
    def parse_and_expr():
        left = parse_unary()
        while True:
            if peek() == '&&':
                consume('&&')
                right = parse_unary()
                left = ('and', left, right)
            elif peek() and peek() not in ('||', ')'):
                right = parse_unary()
                left = ('and', left, right)
            else:
                break
        return left
    def parse_unary():
        if peek() == '!':
            consume('!')
            operand = parse_unary()
            return ('not', operand)
        return parse_atom()
    def parse_atom():
        if peek() == '(':
            consume('(')
            node = parse_expr()
            consume(')')
            return node
        t = consume()
        if t and t.startswith('#'):
            return ('tag', t[1:])
        return ('tag', t or '')
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

def _eval_tag_ast(node, tag_list_lower):
    if node is None:
        return True
    kind = node[0]
    if kind == 'tag':
        return _tag_matches_token(node[1], tag_list_lower)
    elif kind == 'and':
        return _eval_tag_ast(node[1], tag_list_lower) and _eval_tag_ast(node[2], tag_list_lower)
    elif kind == 'or':
        return _eval_tag_ast(node[1], tag_list_lower) or _eval_tag_ast(node[2], tag_list_lower)
    elif kind == 'not':
        return not _eval_tag_ast(node[1], tag_list_lower)
    return True

tests = [
    ('#work #urgent', ['work', 'urgent', 'notes'], True),
    ('#work #urgent', ['work', 'notes'], False),
    ('#work || #personal', ['personal'], True),
    ('#work || #personal', ['other'], False),
    ('!#done', ['work', 'urgent'], True),
    ('!#done', ['work', 'done'], False),
    ('(#work || #personal) && !#done', ['work'], True),
    ('(#work || #personal) && !#done', ['work', 'done'], False),
    ('#parent', ['parent/child'], True),
    ('#parent', ['other'], False),
    ('!#archive', ['work', 'notes'], True),
    ('#work/projects', ['work/projects/alpha'], True),
    ('#work/projects', ['work'], False),
]

all_pass = True
for expr, tags, expected in tests:
    tokens = _tokenize_tag_expr(expr)
    ast_node = _parse_tag_ast(tokens)
    result = _eval_tag_ast(ast_node, tags)
    status = 'PASS' if result == expected else 'FAIL'
    if result != expected:
        all_pass = False
    print(f'{status} | {expr:45s} tags={str(tags):40s} -> {result} (expected {expected})')

print(f'\n{"All tests passed!" if all_pass else "SOME TESTS FAILED"}')

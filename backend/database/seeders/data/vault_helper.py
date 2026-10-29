import os

def php_quote(s):
    escaped = s.replace('\\', '\\\\').replace("'", "\\'")
    return f"'{escaped}'"

def to_php_array(data, indent=0):
    spaces = ' ' * indent
    if isinstance(data, dict):
        lines = ['[']
        for k, v in data.items():
            k_repr = str(k) if isinstance(k, int) else php_quote(str(k))
            lines.append(f"{spaces}    {k_repr} => {to_php_array(v, indent + 4)},")
        lines.append(f"{spaces}]")
        return '\n'.join(lines)
    elif isinstance(data, list):
        lines = ['[']
        for item in data:
            lines.append(f"{spaces}    {to_php_array(item, indent + 4)},")
        lines.append(f"{spaces}]")
        return '\n'.join(lines)
    elif isinstance(data, str):
        return php_quote(data)
    elif isinstance(data, bool):
        return 'true' if data else 'false'
    elif isinstance(data, (int, float)):
        return str(data)
    elif data is None:
        return 'null'
    else:
        return php_quote(str(data))

def write_php_file(filepath, data):
    php_content = "<?php\n\n// Auto-generated curated vault questions for Mellow Vault AI Interview\n\nreturn " + to_php_array(data) + ";\n"
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(php_content)
    print(f"Wrote {filepath} ({len(data)} sets)")


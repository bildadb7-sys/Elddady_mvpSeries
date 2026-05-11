import re

def convert_md_to_jsx(md_file, component_name, output_file):
    with open(md_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    jsx = []
    jsx.append(f"import React from 'react';")
    jsx.append(f"import {{ useNavigate }} from 'react-router-dom';")
    jsx.append(f"")
    jsx.append(f"const {component_name}: React.FC = () => {{")
    jsx.append(f"    const navigate = useNavigate();")
    jsx.append(f"    return (")
    jsx.append(f"        <div className=\"min-h-screen bg-background text-foreground font-sans p-4 md:p-8 overflow-y-auto pb-24\">")
    jsx.append(f"            <div className=\"max-w-4xl mx-auto bg-card p-6 md:p-10 rounded-xl shadow-lg border border-border\">")
    jsx.append(f"                <button onClick={{() => navigate(-1)}} className=\"mb-6 text-muted-foreground hover:text-primary transition-colors flex items-center gap-2\">")
    jsx.append(f"                    <i className=\"fas fa-arrow-left\"></i> Back")
    jsx.append(f"                </button>")
    
    in_list = False
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Replace bold markdown with strong tags
        line = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', line)
        
        if line.startswith('# '):
            title = line[2:]
            jsx.append(f"                <h1 className=\"text-3xl md:text-4xl font-bold text-primary mb-8 border-b border-border pb-4\">{{`{title}`}}</h1>")
        elif line.startswith('## '):
            if in_list:
                jsx.append("                </ul>")
                in_list = False
            title = line[3:]
            jsx.append(f"                <h2 className=\"text-xl md:text-2xl font-bold text-foreground mt-8 mb-4\">{{`{title}`}}</h2>")
        elif line.startswith('- '):
            if not in_list:
                jsx.append("                <ul className=\"list-disc list-inside space-y-2 text-muted-foreground ml-4 mb-4\">")
                in_list = True
            item = line[2:]
            # Escape curly braces for valid JSX
            item = item.replace('{', '{{').replace('}', '}}').replace('`', '\\`')
            jsx.append(f"                    <li dangerouslySetInnerHTML={{{{ __html: `{item}` }}}} />")
        else:
            if in_list:
                jsx.append("                </ul>")
                in_list = False
            # check if it starts with numbering like '1.1' or '1.'
            line = line.replace('{', '{{').replace('}', '}}').replace('`', '\\`')
            if re.match(r'^\d+\.', line):
                jsx.append(f"                <p className=\"mb-4 text-muted-foreground leading-relaxed\" dangerouslySetInnerHTML={{{{ __html: `{line}` }}}} />")
            else:
                jsx.append(f"                <p className=\"mb-4 text-muted-foreground leading-relaxed\" dangerouslySetInnerHTML={{{{ __html: `{line}` }}}} />")

    if in_list:
        jsx.append("                </ul>")
        
    jsx.append(f"            </div>")
    jsx.append(f"        </div>")
    jsx.append(f"    );")
    jsx.append("};")
    jsx.append(f"")
    jsx.append(f"export default {component_name};")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(jsx))

convert_md_to_jsx('Privacy_Policy.md', 'PrivacyPolicyPage', 'components/PrivacyPolicyPage.tsx')
convert_md_to_jsx('Terms_and_Conditions.md', 'TermsAndConditionsPage', 'components/TermsAndConditionsPage.tsx')

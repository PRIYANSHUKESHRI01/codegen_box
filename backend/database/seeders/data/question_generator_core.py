import os
import sys

sys.path.append(os.path.dirname(__file__))
from vault_helper import write_php_file

def make_q(text, note, topic, duration=180, category='technical'):
    return {
        'text': text,
        'category': category,
        'duration_seconds': duration,
        'note': note,
        'topic': (topic[:95]) if topic else None,
        'needs_review': False,
        'origin': 'staff',
        'image': None
    }

# Template helper to construct 3 rounds of 5 questions for a given set
def build_set_rounds(r1_qs, r2_qs, r3_qs):
    return {
        1: r1_qs,
        2: r2_qs,
        3: r3_qs
    }

def generate_domain_parent_sets(stack_key, domain_name, core_concepts, framework_concepts, prod_concepts, adv_concepts, scale_concepts):
    return {
        2: build_set_rounds(
            [make_q(f"How do {c[0]} work in {domain_name}? Explain the internal mechanics and implementation best practices.", c[1], c[0]) for c in core_concepts[:5]],
            [make_q(f"How do you implement {c[0]} in {domain_name} for production applications?", c[1], c[0]) for c in framework_concepts[:5]],
            [make_q(f"Describe how to debug and solve {c[0]} in {domain_name}.", c[1], c[0]) for c in prod_concepts[:5]],
        ),
        3: build_set_rounds(
            [make_q(f"How do you design robust APIs and contracts with {c[0]} in {domain_name}?", c[1], c[0]) for c in prod_concepts[5:10]],
            [make_q(f"Explain how database persistence and transaction management work with {c[0]} in {domain_name}.", c[1], c[0]) for c in prod_concepts[10:15]],
            [make_q(f"How do you handle monitoring, queues, and observability for {c[0]} in {domain_name}?", c[1], c[0]) for c in prod_concepts[15:20]],
        ),
        4: build_set_rounds(
            [make_q(f"How do you handle high-throughput concurrency and async patterns with {c[0]} in {domain_name}?", c[1], c[0]) for c in adv_concepts[:5]],
            [make_q(f"Explain performance profiling and latency optimization strategies for {c[0]} in {domain_name}.", c[1], c[0]) for c in adv_concepts[5:10]],
            [make_q(f"How do you secure {c[0]} in {domain_name} against OWASP vulnerabilities and security threats?", c[1], c[0]) for c in adv_concepts[10:15]],
        ),
        5: build_set_rounds(
            [make_q(f"How would you architect an enterprise system using {c[0]} in {domain_name} at scale?", c[1], c[0]) for c in scale_concepts[:5]],
            [make_q(f"Explain fault tolerance, high-availability, and disaster recovery strategies for {c[0]} in {domain_name}.", c[1], c[0]) for c in scale_concepts[5:10]],
            [make_q(f"Walk through triaging a severe live production incident involving {c[0]} in {domain_name}.", c[1], c[0]) for c in scale_concepts[10:15]],
        ),
    }


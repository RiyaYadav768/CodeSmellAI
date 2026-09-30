import tempfile
import unittest
from pathlib import Path

from smell_detector import (
    GOD_CLASS_METHOD_THRESHOLD,
    LARGE_FILE_LOC_THRESHOLD,
    LONG_FUNCTION_LINE_THRESHOLD,
    MAX_NESTING_DEPTH,
    MAX_PARAMETER_COUNT,
    analyze_file,
    analyze_source,
    rule_deep_nesting,
    rule_god_class,
    rule_large_file,
    rule_long_function,
    rule_too_many_parameters,
)


class SmellDetectorTests(unittest.TestCase):
    def test_each_rule_triggers_and_does_not_trigger(self):
        long_body = "\n".join(["    value = 1"] * LONG_FUNCTION_LINE_THRESHOLD)
        long_source = f"def long():\n{long_body}\n"
        self.assertEqual(analyze_source(long_source)["smell_breakdown"]["long_function"], 1)
        self.assertEqual(analyze_source("def short():\n    return 1\n")["smell_breakdown"]["long_function"], 0)

        params = ", ".join(f"arg{index}" for index in range(MAX_PARAMETER_COUNT + 1))
        self.assertEqual(analyze_source(f"def many({params}):\n    pass\n")["smell_breakdown"]["too_many_parameters"], 1)
        self.assertEqual(analyze_source("def one(arg):\n    pass\n")["smell_breakdown"]["too_many_parameters"], 0)

        nested = "value = 0\n"
        for _ in range(MAX_NESTING_DEPTH + 1):
            nested += "if True:\n" + "    " * (_ + 1)
        nested += "value += 1\n"
        self.assertGreater(analyze_source(nested)["smell_breakdown"]["deep_nesting"], 0)
        self.assertEqual(analyze_source("if True:\n    value = 1\n")["smell_breakdown"]["deep_nesting"], 0)

        large_source = "value = 1\n" * (LARGE_FILE_LOC_THRESHOLD + 1)
        self.assertEqual(analyze_source(large_source)["smell_breakdown"]["large_file"], 1)
        self.assertEqual(analyze_source("value = 1\n")["smell_breakdown"]["large_file"], 0)

        methods = "\n".join(f"    def method{index}(self):\n        pass" for index in range(GOD_CLASS_METHOD_THRESHOLD + 1))
        self.assertEqual(analyze_source(f"class Large:\n{methods}\n")["smell_breakdown"]["god_class"], 1)
        self.assertEqual(analyze_source("class Small:\n    def method(self):\n        pass\n")["smell_breakdown"]["god_class"], 0)

    def test_rules_can_be_toggled(self):
        source = "def short():\n    return 1\n"
        result = analyze_source(source, enabled_rules={"large_file"})
        self.assertEqual(result["smell_breakdown"], {"large_file": 0})

    def test_empty_and_syntax_error_files_are_skipped_safely(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            empty = root / "empty.py"
            broken = root / "broken.py"
            empty.write_text("")
            broken.write_text("def broken(:\n")
            self.assertEqual(analyze_file(empty, root)["loc"], 0)
            self.assertIsNone(analyze_file(broken, root))


if __name__ == "__main__":
    unittest.main()
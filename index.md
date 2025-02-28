---
type: article
title: Getting Started
description: Getting started with the Mojo programming language
date: 2025-02-24
tag: intro-to-gpu
---

# Getting Started

## What is Mojo?

Mojo is a performance-focused language that provides ergonomic access to low-level primitives like SIMD and GPU intrinsics. It retains Python-like syntax and usability, making it easier for Python developers to write high-performance code for both CPU and GPU without learning an entirely new language.

## Install the Magic CLI

The language has a package manager to make integration with the Python ecosystem seamless, simply run:

```sh
curl -ssL https://magic.modular.com | bash
```

```text
Installing the latest version of Magic...
Done. The 'magic' binary is in '/Users/jack/.modular/bin'
```

Restart your terminal and initialize a new project, then `cd` into the project:

```sh
magic init --format mojoproject hello
```

```text
✔ Created /private/var/folders/z4/syf53w0d243ft3bpzdj55s9w0000gn/T/mdl/hello/mojoproject.toml
✔ Added max >=25.1.0.dev2025020905,<26
```

Make sure your in the `hello` directory we just created:

```mojo
cd hello
```

## Your First Mojo Program

Create a file named `hello.mojo`:

```mojo :create=hello/hello.mojo
def main():
    print("Hello Mojo🔥")
```

And run it with:

```sh
magic run mojo hello.mojo
```

```text
Hello Mojo🔥
```

## Adding a Task

Create a task that accepts standard bash-like commands:

```sh
magic task add hello "magic run mojo hello.mojo"
```

```text
✔ Added task `hello`: magic run mojo hello.mojo
```

And run it with:

```sh
magic run hello
```

```text
Hello Mojo🔥
```

## Adding Community Packages

`max` is the official Modular package that allows you to write GPU kernels standalone with Mojo, or call them from Python. Let's modify the version to be a wildcard so it'll use the latest compatible version with any community packages we add:

```sh
magic add "max==*"
```

```text
✔ Added max==*
```

And add a community package to the project:

```sh
magic add emberjson
```

```text
✔ Added emberjson >=0.1.1,<0.2
```

Update the `hello.mojo` file to use the community package:

```mojo :create=hello/hello.mojo
from emberjson import parse

def main():
    json = parse('{"Hello": "Mojo🔥"}')
    print(json["Hello"])
```

And run it again with:

```sh
magic run hello
```

```text
"Mojo🔥"
```

You can find curated Mojo community packages at [builds.modular.com](https://builds.modular.com/?category=packages).

## The `mojoproject.toml` File

This file has been modified automatically while we've been running commands to update our project:

```toml
[project]
...
channels = [
    "https://conda.modular.com/max-nightly",
    "https://repo.prefix.dev/modular-community",
    "conda-forge"
]
name = "hello"
platforms = ["osx-arm64"]
version = "0.1.0"

[tasks]
hello = "mojo run hello.mojo"

[dependencies]
max = "*"
emberjson = ">=0.1.1,<0.2"
```

You can modify this file directly to add more dependencies and tasks.

## Activate the Virtual Environment

If you'd prefer to put Mojo and other installed binaries on path so you can call them directly, you can activate the virtual environment:

```sh
magic shell
mojo run hello.mojo
```

## Install Mojo globally

If you prefer to traditional experience of a globally installed binary, you can run:

```sh
magic global install max
# On Linux
magic global expose add -e max $(find "$HOME/.modular/envs/max/bin" -type f -executable -exec basename {} \;)
# On MacOS
magic global expose add -e max $(find "$HOME/.modular/envs/max/bin" -type f -exec basename {} \;)
```

This will add the Mojo binary and utilities like lsp, debugger, formatter etc to your global PATH so you can call it directly from the terminal:

```sh
mojo --version
```

```text
mojo 25.1.0.dev2025020905
```

## Running Mojo in a notebook

If you clone the repo at <https://github.com/jackos/intro-to-gpu> and install the vscode extension `Markdown Lab` you can run the markdown that generated this website like a notebook, without installing jupyter.

## Next Steps

::: tip CS Fundamentals
If you have only used garbage collected languages like Python, you can run through the [Systems Programming](/systems-programming) guide to get a primer on concepts like memory management, pointers, stack and heap memory.
:::

Or if you have experience with languages like Rust or C++, click the `Intro to GPU` button to get started writing GPU code!

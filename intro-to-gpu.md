---
type: article
title: Intro to GPU
description: An introduction to programming GPUs
date: 2025-02-24
tag: intro-to-gpu
---

# Introduction to GPU programming

This course is designed for both CUDA developers and programmers that have never written code for a GPU, if you come from a CUDA background you can skip over these gray text bubbles and instead focus on the code.

::: info Parallel programming
Programmers can no longer rely on new generations of CPUs to improve the performance of their programs. We've hit a wall with increasing clock speeds due to power requirements and heat dissipation limitations, this has shifted focus and progress to increase the amount of physical cores. Consumer CPUs now commonly contain 16 physical cores and beyond which can run in parallel, changing the model in which programmers have to think to maximize performance. The most demanding applications have become AI applications which are "embarrassingly parallel", meaning that the performance scales extremely well with the amount of extra cores.

NVIDIA's greatest insight was that they could enable a general programming model through CUDA to allow users to write applications for any domain on both their server and consumer GPUs. This led to the explosion of AI capability when Alex Krizhevsky, Ilya Sutskever, and Geoffrey Hinton trained AlexNet on NVIDIA GTX 580 and 680 consumer GPUs, which dramatically outperformed traditional computer vision approaches. A GPU has many more physical cores than a traditional CPU, for example the NVIDIA H100 can have 16,896 threads running in parallel in a single clock cycle, while allowing over 270,000 threads to be loaded and ready to run.

Taking advantage of this specialized hardware requires a different mental model for programming. Mojo represents an opportunity to completely rethink that programming model to make it more accessible. The world of programming has seen many improvements to both ergonomics and memory safety since the domination of C++ for systems programming. Not all of these improvements are mappable to GPU programming, as these are performance focussed applications which need to opt for performance where an ergonomic or memory safety tradeoff exists. Mojo's main goal as a language is to have a familiar syntax for Python developers, with the safety and ergonomic improvements of modern systems programming languages like Rust, and allow you to directly use GPU primitives. This creates a stepping stone for programmers with much lower levels of specialized knowledge to write performant AI applications. That is the aim of this course, to enable a much larger demographic of programmers to write GPU and AI software. We believe this will enable more breakthroughs and accelerate progress.
:::

These blue text bubbles contain setup information and tips.

::: tip Setup


All of these notebook cells are runnable through a VS Code extension. You can install [Markdown Lab](https://marketplace.visualstudio.com/items?itemName=jackos.mdlab), then clone the repo that contains the markdown that generated this website:

```sh
git clone git@github.com:jackos/intro-to-gpu
cd intro-to-gpu
```

And open `intro-to-gpu.md`, then you can run the code cells interactively.

If you prefer the traditional approach, create a file such as `main.mojo` and put everything except the imports into a `def main`:

```mojo :once
from gpu import thread_idx, DeviceContext

def main():
    fn printing_kernel():
        print("GPU thread: [", thread_idx.x, thread_idx.y, thread_idx.z, "]")

    var ctx = DeviceContext()

    ctx.enqueue_function[printing_kernel](grid_dim=1, block_dim=4)
    ctx.synchronize()
```

Then run the file e.g. `mojo main.mojo`, if you haven't setup Mojo yet, check out the [Getting Started](index.md) guide.

:::

## Imports

These are all the imports required to run the examples, put this at the top of your file if you're running from `mojo main.mojo`:

```mojo
from gpu import thread_idx, block_idx, warp, barrier
from gpu.host import DeviceContext, DeviceBuffer
from gpu.memory import AddressSpace, external_memory
from layout import Layout, LayoutTensor
from math import iota
from sys import sizeof
```

## Your first kernel

In the context of GPU programming, a kernel is a program that runs on each thread that you launch

```mojo
fn printing_kernel():
    print("GPU thread: [", thread_idx.x, thread_idx.y, thread_idx.z, "]")
```

We can pass this function as a [parameter](glossary.md#parameter) to `enqueue_function` to compile it for your attached GPU and launch it. First we need to get the `DeviceContext` for your GPU:

```mojo
var ctx = DeviceContext()
```

Now we have the `DeviceContext` we can compile and launch the kernel:

```mojo :once
ctx.enqueue_function[printing_kernel](grid_dim=1, block_dim=4)

# Wait for the kernel to finish executing before handing back to CPU
ctx.synchronize()
```

```text
GPU thread: [ 0 0 0 ]
GPU thread: [ 1 0 0 ]
GPU thread: [ 2 0 0 ]
GPU thread: [ 3 0 0 ]
```


## Threads

Because we passed `block_dim=4`, we launched 4 threads on the x dimension, the kernel code we wrote is executed on each thread. The printing can be out of order depending on which thread reaches that `print` call first.

Now lets add the y and z dimensions with `block_dim(2, 2, 2)`:

```mojo :once
ctx.enqueue_function[printing_kernel](grid_dim=1, block_dim=(2, 2, 2))
ctx.synchronize()
```

```text
GPU thread: [ 0 0 0 ]
GPU thread: [ 1 0 0 ]
GPU thread: [ 0 1 0 ]
GPU thread: [ 1 1 0 ]
GPU thread: [ 0 0 1 ]
GPU thread: [ 1 0 1 ]
GPU thread: [ 0 1 1 ]
GPU thread: [ 1 1 1 ]
```

We're now launching 8 (2x2x2) threads in total.

## Host vs Device and Enqueue

You'll see the word `host` which refers to the CPU that schedules work for the `device`, `device` refers to the accelerator which in this case is a GPU.

If you see the `enqueue` word in a method or function call it means the `host` is scheduling it run on the `device`. You must call `ctx.synchronize` if code you're running on the `host` is dependent on the result of the `device` enqueued calls. For example, if you were to print from the CPU without first calling `synchronize`, you could see out-of-order printing:

```mojo :once
ctx.enqueue_function[printing_kernel](grid_dim=1, block_dim=4)
print("This might finish before the GPU has completed its work")
```

```text
This might finish before the GPU has completed its work
GPU thread: [ 0 0 0 ]
GPU thread: [ 1 0 0 ]
GPU thread: [ 2 0 0 ]
GPU thread: [ 3 0 0 ]
```

In the above example we failed to call `synchronize` before printing on the `host`, the `device` could be slightly slower to finish its work, so you might see that output after the `host` output. Let's add a `synchronize`:

```mojo :once
ctx.enqueue_function[printing_kernel](grid_dim=1, block_dim=4)
ctx.synchronize()
print("This will finish after the GPU has completed its work")
```

```text
GPU thread: [ 0 0 0 ]
GPU thread: [ 1 0 0 ]
GPU thread: [ 2 0 0 ]
GPU thread: [ 3 0 0 ]
This will finish after the GPU has completed its work
```

Note that any method or function you `enqueue` to run on the device, will run in the order that you enqueued them. It's only when you're doing something from the `host` which is dependent on the results of enqueued calls that you have to `synchronize`:

```mojo
alias size = 4
alias type = DType.uint8


fn dummy_kernel(buffer: DeviceBuffer[type]):
    buffer[thread_idx.x] = thread_idx.x

# More on buffers later
var host_buffer = ctx.enqueue_create_host_buffer[type](size)
var dev_buffer = ctx.enqueue_create_buffer[type](size)
ctx.enqueue_function[dummy_kernel](dev_buffer, grid_dim=1, block_dim=size)
dev_buffer.enqueue_copy_to(host_buffer)
# All of the above calls run in the order that they were enqueued

# Have to synchronize here before printing on CPU, or else the kernel will
# not have finished execcuting.
ctx.synchronize()

for i in range(size):
    print(host_buffer[i], end=" ")
print()
```

```text
0 1 2 3 
```

These orange text bubbles contain important information to remember, in order to not cause segfaults and other safety violations.

::: warning Synchronization

If your using the results of any `enqueue` calls from the CPU, you must synchronize before doing anything that is dependent on what you're enqueuing. Enqueueing multiple method or function calls for a single GPU is safe, as they are scheduled to run in the order you call them.
:::

## Blocks

Lets set up a new kernel to demonstrate how blocks work:

```mojo :once
fn block_kernel():
    print(
        "block: [",
        block_idx.x,
        block_idx.y,
        block_idx.z,
        "]",
        "thread: [",
        thread_idx.x,
        thread_idx.y,
        thread_idx.z,
        "]"
    )

ctx.enqueue_function[block_kernel](grid_dim=(2, 2), block_dim=2)
ctx.synchronize()
```

```text
block: [ 1 1 0 ] thread: [ 0 0 0 ]
block: [ 1 1 0 ] thread: [ 1 0 0 ]
block: [ 0 0 0 ] thread: [ 0 0 0 ]
block: [ 0 0 0 ] thread: [ 1 0 0 ]
block: [ 0 1 0 ] thread: [ 0 0 0 ]
block: [ 0 1 0 ] thread: [ 1 0 0 ]
block: [ 1 0 0 ] thread: [ 0 0 0 ]
block: [ 1 0 0 ] thread: [ 1 0 0 ]
```

We're still launching 8 (2x2x2) threads, where there are 4 blocks, each with 2 threads. In GPU programming this grouping of blocks and threads is important, each block can have its own fast shared VRAM (Video Random Access Memory) which allows threads to communicate. The threads within a block can also communicate by through registers, we'll cover this concept when we get to `warps`. For now the important information to internalize is:

- `grid_dim` defines how many blocks are launched
- `block_dim` defines how many threads are launched in each block

## Tiles

The x, y, z dimensions of blocks are important for splitting up large jobs into `tiles` so each thread can work on its own subset of the problem. Lets visualize how a contiguous array of data can be split up into tiles, if we have an array of UInt32 (Unsigned Integer 32bit) data like:

```plaintext
[ 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 ]
```

We could split work up between threads and blocks, we're only going to use the x dimension for threads and blocks to get started:

```plaintext
Thread  |    0  1  2  3
-------------------------
block 0 | [  0  1  2  3 ]
block 1 | [  4  5  6  7 ]
block 2 | [  8  9 10 11 ]
block 3 | [ 12 13 14 15 ]
```

If you had a much larger data array you could further split it up in into tiles, e.g. tile with widths [2, 2] at index (0, 0) would be:

```plaintext
[ 0 1 ]
[ 4 5 ]
```

And index (1, 0) would be:

```plaintext
[ 2 3 ]
[ 6 7 ]
```

This is where you'd introduce the y dimension. For now we're going to focus on how blocks and threads interact, splitting up an array into 1 row per block, and 1 value per thread.

## Host Buffer

First we'll initialize that contiguous array on CPU and fill in the values:

```mojo
alias dtype = DType.uint32
alias blocks = 4
alias threads = 4
# One value per thread
alias in_els = blocks * threads

# Allocate data on the host and return a buffer which owns that data
var in_host = ctx.enqueue_create_host_buffer[dtype](in_els)

# Fill in the buffer with values from 0 to 16
iota(in_host.unsafe_ptr(), in_els)

# Load all the data as a SIMD vector of width 16 and print it
print(in_host.unsafe_ptr().load[width=in_els](0))
```

```text
[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
```

In the last call where we print it using `load[width=in_els]` we're loading a SIMD vector of width 16. SIMD means `Single Instruction Multiple Data`, in Mojo all the core numerical dtypes are built around SIMD, allowing you to e.g. multiply a vector in a single instruction using special registers, instead of 16 instructions for each element.

## Device Buffer

We now have a host buffer that we can copy to the GPU:

```mojo
# Allocate a buffer for the GPU
var in_dev = ctx.enqueue_create_buffer[dtype](in_els)

# Copy the data from the CPU to the GPU buffer
in_host.enqueue_copy_to(in_dev)
```

Creating the GPU buffer is allocating `global memory` which can be accessed from any block and thread, this memory is relatively slow compared to `shared memory` which is shared between blocks, more on that later.

## Tensor indexing from threads

Now that we have the data set up, we can wrap the data in a `LayoutTensor` so that we can reason about how to index into the array, allowing each thread to get its corresponding value:

```mojo
# Row major: elements are stored sequentially in memory [0, 1, 2, 3, 4, 5, ...]
# Column major: used in some GPU optimizations, stored as [0, 4, 8, 12, 1, ...]
alias layout = Layout.row_major(blocks, threads)

var tensor = LayoutTensor[dtype, layout](in_dev)
```

This `LayoutTensor` is a wrapper over the data stored inside `in_dev`, it doesn't own its memory but allows us to index using block and thread ids. Initially we'll just print the values to confirm its indexing as we expect:

```mojo :once
fn print_values_kernel(tensor: LayoutTensor[dtype, layout]):
    var bid = block_idx.x
    var tid = thread_idx.x
    print("block:", bid, "thread:", tid, "val:", tensor[bid, tid])

ctx.enqueue_function[print_values_kernel](
    tensor, grid_dim=blocks, block_dim=threads,
)
ctx.synchronize()
```

```text
block: 3 thread: 0 val: 12
block: 3 thread: 1 val: 13
block: 3 thread: 2 val: 14
block: 3 thread: 3 val: 15
block: 2 thread: 0 val: 8
block: 2 thread: 1 val: 9
block: 2 thread: 2 val: 10
block: 2 thread: 3 val: 11
block: 0 thread: 0 val: 0
block: 0 thread: 1 val: 1
block: 0 thread: 2 val: 2
block: 0 thread: 3 val: 3
block: 1 thread: 0 val: 4
block: 1 thread: 1 val: 5
block: 1 thread: 2 val: 6
block: 1 thread: 3 val: 7
```

As in the visualization above, the block/thread is getting the corresponding value that we expect. You can see `block: 3 thread: 3` has the last value 15.

## Multiply Kernel

Now that we've verified we're getting the correct values when indexing, lets launch a kernel to multiply each value:

```mojo :once
fn multiply_kernel[multiplier: Int](tensor: LayoutTensor[dtype, layout]):
    tensor[block_idx.x, thread_idx.x] *= multiplier

ctx.enqueue_function[multiply_kernel[2]](
    tensor,
    grid_dim=blocks,
    block_dim=threads,
)

# Copy data back to host and print as 2D array
in_dev.enqueue_copy_to(in_host)
ctx.synchronize()

var host_tensor = LayoutTensor[dtype, layout](in_host)
print(host_tensor)
```

```text
0 2 4 6 
8 10 12 14 
16 18 20 22 
24 26 28 30 
```

Congratulations! You've successfully run a kernel that modifies values from your GPU, and printed the result on your CPU. You can see above that each thread multiplied a single value by 2 in parallel on the GPU, and copied the result back to the CPU.

## Sum Reduce Output Tensor

We're going to set up a new buffer which will have all the reduced values with the sum of each thread in the block:

```plaintext
Output: [ block[0] block[1] block[2] block[3] ]
```

Set up the output buffer for the host and device:

```mojo
var out_host = ctx.enqueue_create_host_buffer[dtype](blocks)
var out_dev = ctx.enqueue_create_buffer[dtype](blocks)

# Zero the values on the device as they'll be used to accumulate results
ctx.enqueue_memset(out_dev, 0)
```

The problem here is that we can't have all the threads summing their values into the same index in the output buffer as that will introduce race conditions. We're going to introduce new concepts to deal with this.

## Shared memory

This is not an optimal solution, but it's a good way to introduce shared memory in a simple example, we'll cover better solutions in the next sections. You can allocate data for each block when launching a kernel, this is called shared memory and every thread within a block can communicate using it.

```mojo :once
fn sum_reduce_kernel(
    tensor: LayoutTensor[dtype, layout], out_buffer: DeviceBuffer[dtype]
):
    # Get a pointer to shared memory for the indices and values
    var shared = external_memory[
        Scalar[dtype],
        address_space = AddressSpace.SHARED,
        alignment = sizeof[dtype](),
    ]()

    # Place the corresponding value into shared memory
    shared[thread_idx.x] = tensor[block_idx.x, thread_idx.x][0]

    # Await all the threads to finish loading their values into shared memory
    barrier()

    # If this is the first thread, sum and write the result to global memory
    if thread_idx.x == 0:
        for i in range(threads):
            out_buffer[block_idx.x] += shared[i]

ctx.enqueue_function[sum_reduce_kernel](
    tensor,
    out_dev,
    grid_dim=blocks,
    block_dim=threads,
    shared_mem_bytes=blocks * sizeof[dtype](), # Shared memory between blocks
)

# Copy the data back to the host and print out the SIMD vector
out_dev.enqueue_copy_to(out_host)
ctx.synchronize()

print(out_host.unsafe_ptr().load[width=blocks]())
```

```text
[6, 22, 38, 54]
```

For our first block/tile we summed the values:

```plaintext
sum([ 0 1 2 3 ]) == 6
```

And the reduction resulted in the output having the sum of 6 in the first position. Every tile/block has been reduced to:

```plaintext
[ 6 22 38 54]
```

## Thread level SIMD

We could skip using shared memory altogether using SIMD instructions, this is a faster option to consider if it suits your problem. Each thread has access to SIMD registers which can perform operations on a vector such as reductions. Here we'll be launching one thread per block, loading the 4 corresponding values from that block as a SIMD vector, and summing them together in a single operation:

```mojo :once

fn simd_reduce_kernel(
    tensor: LayoutTensor[dtype, layout], out_buffer: DeviceBuffer[dtype]
):
    out_buffer[block_idx.x] = tensor.load[4](block_idx.x, 0).reduce_add()

# Reset the output values first
ctx.enqueue_memset(out_dev, 0)

ctx.enqueue_function[simd_reduce_kernel](
    tensor,
    out_dev,
    grid_dim=blocks,
    block_dim=1, # one thread per block
)

# Ensure we have the same result
out_dev.enqueue_copy_to(out_host)
ctx.synchronize()

print(out_host.unsafe_ptr().load[width=blocks]())
```

```text
[6, 22, 38, 54]
```

This is much cleaner and faster, instead of 4 threads writing to shared memory, we're using 1 thread per block to do a single SIMD reduction. Shared memory has many uses, but as you learn more tools you'll be able decipher which is the most performant for your particular problem.

## Warps

A `warp` is a group of threads (32 on NVIDIA, 64 on AMD) within a block. Threads within the same warp can synchronize their execution, and at a particular step perform SIMD instructions using values from the other threads in lockstep. We have only 4 threads within each block, well under the 32 limit, if this wasn't the case you'd have to do two reductions, one from each warp to shared memory, then another from shared memory to the output buffer/tensor.

Lets write your first warp reduction kernel:

```mojo :once
fn warp_reduce_kernel(
    tensor: LayoutTensor[dtype, layout], out_buffer: DeviceBuffer[dtype]
):
    var value = tensor.load[1](block_idx.x, thread_idx.x)

    # Each thread gets the value from one thread higher, summing them as they go
    value = warp.sum(value)

    barrier()

    # Thread 0 has the reduced sum of the values from all the other threads
    if thread_idx.x == 0:
        out_buffer[block_idx.x] = value

ctx.enqueue_memset(out_dev, 0)

ctx.enqueue_function[warp_reduce_kernel](
    tensor,
    out_dev,
    grid_dim=blocks,
    block_dim=threads,
)
ctx.synchronize()

# Ensure we have the same result
out_dev.enqueue_copy_to(out_host)
ctx.synchronize()

print(out_host.unsafe_ptr().load[width=blocks]())
```

```text
[6, 22, 38, 54]
```

It might not be immediately clear what's happening with the `warp.sum` function, so let's break it down with print statements:

```mojo :once
fn warp_print_kernel(tensor: LayoutTensor[dtype, layout]):
    var value = tensor.load[1](block_idx.x, thread_idx.x)

    # Get the value from the thread 1 position higher
    var next_value = warp.shuffle_down(value, offset=1)

    if block_idx.x == 0:
        print("thread:", thread_idx.x, "value:", value, "next_value:", next_value)

ctx.enqueue_function[warp_print_kernel](
    tensor,
    grid_dim=blocks,
    block_dim=threads,
)
ctx.synchronize()
```

```text
thread: 0 value: 0 next_value: 1
thread: 1 value: 1 next_value: 2
thread: 2 value: 2 next_value: 3
thread: 3 value: 3 next_value: 0
```

In the above print statements, you can see that each thread is getting the value from the thread 1 position higher in the block. When we get to the 4th thread it returns 0 as there is no higher thread. Instead of using `warp.sum` we can write our own custom reduction:

```mojo :once
@parameter
fn custom_reduce[
    type: DType, width: Int
](lhs: SIMD[type, width], rhs: SIMD[type, width]) -> SIMD[type, width]:
    return lhs + rhs

fn custom_warp_reduce_kernel(tensor: LayoutTensor[dtype, layout], out_buffer: DeviceBuffer[dtype]):
    var value = tensor.load[1](block_idx.x, thread_idx.x)
    var result = warp.reduce[warp.shuffle_down, custom_reduce](value)

    barrier()

    if block_idx.x == 0:
        print("thread:", thread_idx.x, "value:", value, "result:", result)

    if thread_idx.x == 0:
        out_buffer[block_idx.x] = result

ctx.enqueue_function[custom_warp_reduce_kernel](
    tensor,
    out_dev,
    grid_dim=blocks,
    block_dim=threads,
)

# Check our new result
print("Block 0 reduction steps:")
ctx.copy(out_host, out_dev)
ctx.synchronize()

print("\nAll blocks reduced output buffer:")
print(out_host.unsafe_ptr().load[width=blocks]())
```

```text
Block 0 reduction steps:
thread: 0 value: 0 result: 6
thread: 1 value: 1 result: 6
thread: 2 value: 2 result: 5
thread: 3 value: 3 result: 3

All blocks reduced output buffer:
[6, 22, 38, 54]
```

You can see in the output that the first block had the values [ 0 1 2 3 ] and was reduced from top to bottom (shuffle down) in this way, where the result of one thread is passed to the next thread down:

```plaintext
thread 3: value=3   next_value=N/A   result=3
thread 2: value=2   next_value=3     result=5
thread 1: value=1   next_value=5     result=6
thread 0: value=0   next_value=6     result=6
```

## Exercises

Now that you've learnt some of the core primitives for GPU programming, here are some exercise to cement some of the knowledge. Feel free to go back and look at the examples.

1. Create a host buffer for the input of dtype Int64, with 32 elements, and initialize the numbers ordered sequentially. Copy the host buffer to the device.
2. Create a tensor that wraps the host buffer, with the dimensions (8, 4)
3. Create an host and device buffer for the output of dtype Int64, with 8 elements.
4. Launch a GPU kernel with 8 blocks and 4 threads that takes every value and raises it to the power of 2 using x**2, then does a reduction using your preferred method to write to the output buffer.
5. Copy the device buffer to the host buffer, and print it out on the CPU.

The next chapter coming soon, in the meantime you can check out some [GPU programming examples here](https://github.com/modular/max/tree/main/examples/gpu_functions).

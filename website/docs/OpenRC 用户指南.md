本文是《OpenRC Users Guide》一文的中文翻译。

:::info

- 翻译状态：进行中
- 最后修改日期：2021-12-23
- [翻译时的原文](https://github.com/OpenRC/openrc/blob/dd5a6fa60f619f0db854d51efe8731946d3bfbf5/user-guide.md)
- [原文最新状态](https://github.com/OpenRC/openrc/blob/master/user-guide.md)
- [原文编辑历史](https://github.com/OpenRC/openrc/commits/master/user-guide.md)

:::

## 目的与描述

OpenRC 是为类 Unix 操作系统编写的 init 系统，负责启动和关闭整个系统，包括各类服务。

OpenRC 由 Gentoo 的“Baselayout”软件包进化而来。“Baselayout”是一个完全由 shell 编写的开机管理器（这使得它难以维护和调试，且效率不佳）。

出于性能和灵活性考量，OpenRC 的大部分核心核心代码以 C99 编写，其余部分都是 POSIX sh。OpenRC 的许可证是 BSD-2-Clause。

目前 OpenRC 的源码大约有一万行 C 和四千行 shell 脚本。

OpenRC 可以在 Linux、许多 BSD（起码有 FreeBSD、OpenBSD 和 DragonFlyBSD）和 HURD 上运行。

OpenRC 服务是有状态的（比如 `start`；执行 `start` 会使服务进入“已启动”状态）。

## 开机

通常 PID1（也就是 `init`）会调用 OpenRC 的二进制程序（默认在 `/sbin/openrc`）（默认配置是 sysvinit 作为 `init` 调用 OpenRC）。

OpenRC 会扫描运行级别（默认在 `/etc/runlevels`），构建依赖关系图，然后按需串行或并行（默认是串行）地启动服务脚本。

当所有服务脚本都已启动，OpenRC 就会终止，没有持续运行的守护进程（可以与 monit、runit 或者 s6 集成）。

## 关机

当运行级别变成 0 / 6，或者执行 `reboot`、`halt` 等命令时，OpenRC 会停止所有正在运行的服务，然后启动 `shutdown` 运行级别中的服务。

## 修改服务脚本

通过执行 `rc-service someservice start`、`rc-service someservice start stop`、`rc-service someservice restart`，可以在任何时刻启动 / 停止 / 重启一个服务。另外，尽管不建议这种做法，也可以执行 `/etc/init.d/service start`、`/etc/init.d/service stop`、`/etc/init.d/service restart` 得到一样的结果。

OpenRC 会处理依赖，例如启动 apache 会首先启动网络服务，停止网络服务会先停止 apache。

有一个特殊命令 `zap` 可以让 OpenRC“忘掉”已经启动的服务；最主要的用法是，在一个服务崩溃后，不调用服务脚本中的 stop 函数（可能是损坏的），直接重置服务到停止状态。

不加任何参数，直接执行 `openrc`，将尝试重制所有服务，满足当前运行级别；如果你是手动启动了 apache 然后运行 `openrc`，apache 服务会被停止；当 squid 在当前运行级别中时，如果 squid 崩溃后你运行了 `openrc`，squid 会被重启。

## 运行级别

运行级别是 OpenRC 中的一个概念，类似于 sysvinit 中的运行级别。一个运行级别就是一组需要被启动的服务的集合。不同于用随意的数字命名运行级别，用户可以按需创建自己的运行级别。比如，用户可以创建一个启用所有服务的“默认”运行级别，再创建一个禁用掉部分服务的“省电”运行级别。

`rc-status` 打印当前活跃的运行级别和其中服务的状态：

```bash
# rc-status
 * Caching service dependencies ... [ ok ]
Runlevel: default
 modules                     [  started  ]
 lvm                         [  started  ]
```

所有运行级别都以 `/etc/runlevels/` 中的文件夹的形式呈现，文件夹内是指向服务脚本的软连接。

带参数执行 openrc（`openrc default`）可以切换运行级别；OpenRC 将按需开始和停止服务。

一般通过 `rc-update` 管理运行级别，当然也可以手动管理运行级别。例如 `rc-update add nginx default`——将 nginx 加入 default 默认级别。注意 `rc-update` 不会启动 ngnix！你还得执行 `rc`，或者手动运行服务脚本，或者执行 `rc-service nginx start`。

预设开机会按顺序进入 `sysinit`、`boot` 和 `default` 运行级别。关机会进入 `shutdown` 运行级别。

## `conf.d` 魔术

大部分服务脚本都需要默认值，但为了稳定性，不能随随便便地地加载文件。`openrc-run` 会为 `/etc/init.d` 中的脚本，从 `/etc/conf.d` 加载匹配的文件。

```bash
conf.d/foo:
START_OPTS="--extraparameter sausage"

init.d/foo:
start() {
	/usr/sbin/foo-daemon ${START_OPTS}
}
```

这样分割配置与服务脚本，可以节省大量用于修改服务脚本的时间。

## Start-Stop-Daemon

OpenRC 使用定制版的 start-stop-daemon，与 Debian 的 start-stop-daemon 渊源很深，且兼容后者的语法，但 OpenRC 的 start-up-daemon 是完全从头重写的。

start-up-daemon 负责启动守护进程、让进程进入后台运行、创建 PID 文件，包含许多管理守护进程的功能。

## `/etc/rc.conf`

这个文件管理 OpenRC 的默认配置，还包含了服务脚本的配置变量的示例。

其中就有 `rc_parallel`（用于并行启动），`rc_log`（在文件中记录引导信息）等等。

## ulimit 和 CGroups

单个服务的 `ulimit` 和 `nice` 值可以通过 `rc_ulimit` 变量设置。

在 Linux 下，OpenRC 也可以使用 cgroups 管理进程。配置好内核后，用 /etc/rc.conf 中的 `rc_cgroup_mode` 控制 cgroups 版本，可以选择 cgroups v1、v2 或是两者一起使用，默认配置是两者一起使用。

通过服务的 `conf.d` 可以限制单个服务的资源使用。详情请参考默认 /etc/rc.conf 中的 `LINUX CGROUPS RESOURCE MANAGEMENT` 一节。

## 处理孤儿进程

系统有时会进入这样一种状态：部分服务变成了孤儿进程。比如说，你用 supervise-daemon 监视服务，然后 supervise-daemon 因为不明原因崩溃了。各种系统上处理这种情况的方式不尽相同。

在启用了 cgroups 的 Linux 系统上，所有服务都有一个 cgroup_cleanup 命令，你可以在服务停止时手动运行它：

`# rc-service someservice cgroup_cleanup`

将 `rc_cgroup_cleanup` 设置为 yes，可以使 OpenRC 在服务停止时自动执行 cgroup_cleanup。

## 缓存

为了更好的性能，OpenRC 缓存所有服务的解析前的元数据。缓存默认储存在 `/${RC_SVCDIR}/cache`。

OpenRC 用 `mtime` 检查缓存是否过期。OpenRC 会在服务脚本改变时重载相关的文件并更新缓存。

## 方便函数

OpenRC 包装了 libeinfo 中常用的输出函数，这允许 OpenRC 打印出彩色消息。要在服务脚本中获得一致的输出，请在服务脚本中用 ebegin/eend 输出消息。
